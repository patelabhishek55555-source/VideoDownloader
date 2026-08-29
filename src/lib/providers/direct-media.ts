/**
 * Direct media links.
 *
 * The simplest provider and the one that always works: when the URL itself points
 * at a media file, there is nothing to resolve. A HEAD request is attempted to
 * report a file size, but a failure there never fails the resolution.
 */

import { createHash } from "node:crypto";

import type { ResolvedMedia } from "@/lib/types";
import { extFromUrl } from "@/lib/zip/filename";
import { contentLengthOf, safeFetch } from "@/lib/security/http";
import { cleanFormats, kindForExtension } from "./format";
import type { MediaProvider, ResolveContext } from "./types";

const MEDIA_EXTENSIONS = [
  "mp4",
  "webm",
  "mov",
  "m4v",
  "mkv",
  "avi",
  "mp3",
  "m4a",
  "aac",
  "wav",
  "opus",
  "flac",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
];

export function isDirectMediaUrl(url: URL): boolean {
  const last = url.pathname.split("/").pop() ?? "";
  const match = last.match(/\.([a-z0-9]{2,5})$/i);
  return Boolean(match && MEDIA_EXTENSIONS.includes(match[1]!.toLowerCase()));
}

function titleFromPath(url: URL): string | undefined {
  const last = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const base = last.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim();
  return base.length > 0 && base.length < 120 ? base : undefined;
}

export const directMediaProvider: MediaProvider = {
  id: "direct-media",
  name: "Direct link",
  platform: "direct",
  hosts: [],
  tagline: "Any direct media file link",
  requiresConfiguration: false,
  isFallback: true,

  match(url) {
    return isDirectMediaUrl(url);
  },

  async resolve(url: string, context?: ResolveContext): Promise<ResolvedMedia> {
    const parsed = new URL(url);
    const ext = extFromUrl(url);
    const kind = kindForExtension(ext);

    let fileSize: number | undefined;
    try {
      const head = await safeFetch(url, {
        method: "HEAD",
        timeoutMs: context?.timeoutMs ?? 8000,
        signal: context?.signal,
      });
      if (head.ok) {
        fileSize = contentLengthOf(head);
      }
    } catch {
      // Size and content type are cosmetic — continue without them.
    }

    const formats = cleanFormats([
      {
        url,
        ext,
        kind,
        quality: kind === "video" ? "Original" : kind,
        fileSize,
      },
    ]);

    return {
      id: createHash("sha1").update(url).digest("hex").slice(0, 16),
      providerId: directMediaProvider.id,
      providerName: directMediaProvider.name,
      platform: "direct",
      kind,
      title: titleFromPath(parsed) ?? `${parsed.hostname} media`,
      pageUrl: url,
      formats,
      singleFormat: true,
    };
  },
};
