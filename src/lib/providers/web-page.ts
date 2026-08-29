/**
 * Generic web page provider — the last-resort fallback.
 *
 * Fetches a public page and looks for a media file the page itself advertises:
 * Open Graph video tags, JSON-LD `VideoObject` metadata, or an inline
 * `<video>` / `<source>` element. It only ever reports media the page publishes
 * directly; there is no player instrumentation, no DRM handling, and adaptive
 * (HLS/DASH) manifests are reported as unsupported rather than guessed at.
 */

import { AppError } from "@/lib/errors";
import { getConfig } from "@/lib/config/env";
import { BROWSER_HEADERS, readTextCapped, safeFetch } from "@/lib/security/http";
import type { ResolvedMedia } from "@/lib/types";
import { extFromUrl } from "@/lib/zip/filename";
import { cleanFormats, kindForExtension } from "./format";
import {
  absolutise,
  documentTitle,
  firstMetaContent,
  inlineMediaSources,
  jsonLdVideoObjects,
  metaContent,
  parseIsoDuration,
  unescapeHtml,
} from "./html";
import type { MediaProvider, ResolveContext } from "./types";

const SEGMENTED_PATTERNS = [/\.m3u8(\?|$)/i, /\.mpd(\?|$)/i, /\.ism(\?|$)/i];

function isSegmentedStream(url: string): boolean {
  return SEGMENTED_PATTERNS.some((pattern) => pattern.test(url));
}

function plausibleMediaUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\.(m3u8|mpd|ism)(\?|$)/i.test(url)) return false;
  return true;
}

export const webPageProvider: MediaProvider = {
  id: "web-page",
  name: "Web page",
  platform: "web",
  hosts: [],
  tagline: "Pages that publish a direct video file",
  requiresConfiguration: false,
  isFallback: true,

  match() {
    return true;
  },

  async resolve(url: string, context?: ResolveContext): Promise<ResolvedMedia> {
    const config = getConfig();
    let response: Response;
    try {
      response = await safeFetch(url, {
        timeoutMs: context?.timeoutMs ?? config.limits.fetchTimeoutMs,
        signal: context?.signal,
        headers: { ...BROWSER_HEADERS, accept: "text/html,application/xhtml+xml" },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("provider_error");
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError("private_content", { message: "This page isn't publicly accessible." });
    }
    if (response.status === 404) {
      throw new AppError("not_found", { message: "We couldn't find that page." });
    }
    if (response.status === 429) {
      throw new AppError("rate_limited", { message: "That site is rate limiting us. Please try again shortly." });
    }
    if (!response.ok) {
      throw new AppError("provider_error", { detail: `page responded ${response.status}` });
    }

    const html = await readTextCapped(response, config.limits.maxPageBytes);
    const pageUrl = response.url || url;

    const candidates: string[] = [];
    for (const key of ["og:video:secure_url", "og:video:url", "og:video", "twitter:player:stream"]) {
      const value = absolutise(metaContent(html, key), pageUrl);
      if (value) candidates.push(value);
    }

    for (const video of jsonLdVideoObjects(html)) {
      for (const key of ["contentUrl", "embedUrl", "url"]) {
        const value = absolutise(typeof video[key] === "string" ? (video[key] as string) : undefined, pageUrl);
        if (value) candidates.push(value);
      }
    }

    for (const src of inlineMediaSources(html)) {
      const value = absolutise(src, pageUrl);
      if (value) candidates.push(value);
    }

    const mediaUrl = candidates.find(plausibleMediaUrl);

    if (!mediaUrl) {
      const sawSegmented = candidates.some(isSegmentedStream);
      if (sawSegmented) {
        throw new AppError("unsupported", {
          message:
            "This video uses an adaptive stream that can't be packaged into a single file here. Try a link that points at a direct video file.",
        });
      }
      throw new AppError("not_found", {
        message: "We couldn't find a downloadable video on that page.",
      });
    }

    const ext = extFromUrl(mediaUrl, "mp4");
    const title =
      firstMetaContent(html, ["og:title", "twitter:title"]) ??
      documentTitle(html) ??
      new URL(pageUrl).hostname;

    const thumbnail =
      absolutise(firstMetaContent(html, ["og:image", "twitter:image"]), pageUrl) ?? undefined;

    const durationRaw =
      firstMetaContent(html, ["og:video:duration", "video:duration"]) ?? undefined;
    let duration = durationRaw ? Number(durationRaw) : undefined;
    if (!Number.isFinite(duration) || (duration ?? 0) <= 0) {
      const iso = firstMetaContent(html, ["og:video:duration_iso", "duration"]);
      duration = iso ? parseIsoDuration(iso) : undefined;
    }

    const widthRaw = metaContent(html, "og:video:width");
    const heightRaw = metaContent(html, "og:video:height");

    const formats = cleanFormats([
      {
        url: mediaUrl,
        ext,
        kind: kindForExtension(ext),
        quality: "Original",
        width: widthRaw ? Number(widthRaw) || undefined : undefined,
        height: heightRaw ? Number(heightRaw) || undefined : undefined,
      },
    ]);

    if (formats.length === 0) {
      throw new AppError("not_found", { message: "We couldn't find a downloadable video on that page." });
    }

    return {
      id: `wp${hash(pageUrl).toString(36)}`,
      providerId: webPageProvider.id,
      providerName: webPageProvider.name,
      platform: "web",
      kind: formats[0]!.kind,
      title: unescapeHtml(title).slice(0, 180),
      thumbnail,
      duration,
      pageUrl,
      formats,
      singleFormat: true,
    };
  },
};

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 33 + value.charCodeAt(i)) >>> 0;
  return out;
}
