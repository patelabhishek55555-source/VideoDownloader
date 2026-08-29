/**
 * Remote resolver adapter.
 *
 * Some platforms cannot be resolved with a plain HTTP request — they gate their
 * media behind signed, rotating CDN URLs derived from an authenticated web
 * session. Rather than reverse-engineer each one (and rather than pretend a
 * download button works when it does not), those platforms are served by an
 * external resolver service configured with `DOWNLOAD_PROVIDER_*` variables.
 *
 * Any service implementing the documented contract works: a self-hosted yt-dlp
 * HTTP wrapper, or a commercial resolver API. When nothing is configured these
 * providers fail with `provider_not_configured`, which the UI renders as
 * "Downloader service is not configured."
 */

import { AppError } from "@/lib/errors";
import { getConfig } from "@/lib/config/env";
import { BROWSER_HEADERS, fetchJson } from "@/lib/security/http";
import type { ResolvedMedia } from "@/lib/types";
import { cleanFormats, kindForExtension, type RawFormat } from "./format";
import type { MediaProvider, ResolveContext } from "./types";
import { hostMatches } from "./types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    const nested = asRecord(value);
    if (nested) {
      const found = firstString(nested, keys);
      if (found) return found;
    }
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      const parsed = Number(value);
      if (parsed > 0) return parsed;
    }
  }
  return undefined;
}

function candidateFormatObjects(payload: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > 6 || !node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    const record = node as Record<string, unknown>;
    const looksLikeFormat =
      typeof record.url === "string" ||
      typeof record.src === "string" ||
      typeof record.link === "string" ||
      typeof record.download_url === "string" ||
      typeof record.direct_url === "string";

    if (looksLikeFormat && !seen.has(record)) {
      seen.add(record);
      found.push(record);
      return;
    }

    for (const value of Object.values(record)) walk(value, depth + 1);
  };

  walk(payload, 0);
  return found;
}

function rawFormatFrom(record: Record<string, unknown>): RawFormat | undefined {
  const url = firstString(record, ["url", "src", "link", "download_url", "direct_url", "video_url", "file"]);
  if (!url || !/^https?:\/\//i.test(url)) return undefined;

  const ext = firstString(record, ["ext", "extension", "container", "format"])?.toLowerCase();
  const mime = firstString(record, ["mime", "mime_type", "content_type", "mimetype"]);
  const resolvedExt =
    (ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : undefined) ??
    (mime?.split("/")[1]?.replace(/[^a-z0-9]/g, "") || undefined) ??
    "mp4";

  const height = firstNumber(record, ["height", "resolution_height"]);
  const quality =
    firstString(record, ["quality", "quality_label", "label", "resolution", "format_note"]) ??
    (height ? `${height}p` : undefined);

  const kindRaw = firstString(record, ["type", "kind", "media_type"])?.toLowerCase();
  const kind =
    kindRaw === "image" || kindRaw === "photo"
      ? "image"
      : kindRaw === "audio"
        ? "audio"
        : kindForExtension(resolvedExt);

  return {
    url,
    ext: resolvedExt,
    kind,
    quality,
    height,
    width: firstNumber(record, ["width"]),
    fileSize: firstNumber(record, ["size", "filesize", "bytes", "content_length", "file_size"]),
    hasAudio: typeof record.has_audio === "boolean" ? record.has_audio : undefined,
    fps: firstNumber(record, ["fps", "framerate"]),
  };
}

export interface RemoteResponse {
  title?: string;
  thumbnail?: string;
  duration?: number;
  author?: string;
  formats: RawFormat[];
}

/** Tolerant mapping from a resolver payload to our internal shape. */
export function mapRemoteResponse(payload: unknown): RemoteResponse {
  const root = asRecord(payload);
  if (!root) throw new AppError("provider_error", { detail: "resolver returned a non-object payload" });

  // Explicit failure envelopes.
  const status = firstString(root, ["status", "state"])?.toLowerCase();
  if (status === "error" || status === "failed" || status === "fail") {
    const message = firstString(root, ["message", "error", "detail"]);
    if (message && /private|login|log in|sign in|not public|restricted|age/i.test(message)) {
      throw new AppError("private_content", { message: "This link isn't publicly accessible." });
    }
    if (message && /not found|does not exist|removed|deleted/i.test(message)) {
      throw new AppError("not_found", { message: "We couldn't find any media at that link." });
    }
    throw new AppError("provider_error", { detail: message ?? "resolver reported an error" });
  }
  if (typeof root.error === "string" && root.error.trim()) {
    throw new AppError("provider_error", { detail: root.error });
  }

  const data = asRecord(root.data) ?? asRecord(root.result) ?? asRecord(root.media) ?? root;
  const formats = candidateFormatObjects(payload).map(rawFormatFrom).filter((f): f is RawFormat => Boolean(f));

  return {
    title: firstString(data, ["title", "name", "caption", "text"]),
    thumbnail: firstString(data, ["thumbnail", "thumb", "cover", "poster", "image", "preview"]),
    duration: firstNumber(data, ["duration", "duration_seconds", "length", "video_duration"]),
    author: firstString(data, ["author", "username", "owner", "uploader", "user", "account"]),
    formats,
  };
}

export interface RemoteApiProviderOptions {
  id: string;
  name: string;
  platform: string;
  hosts: readonly string[];
  tagline: string;
  /** Extra copy used when the service is missing, naming the platform. */
  setupHint: string;
}

export function createRemoteApiProvider(options: RemoteApiProviderOptions): MediaProvider {
  return {
    id: options.id,
    name: options.name,
    platform: options.platform,
    hosts: options.hosts,
    tagline: options.tagline,
    requiresConfiguration: true,

    match(url) {
      return hostMatches(url.hostname, options.hosts);
    },

    async resolve(url: string, context?: ResolveContext): Promise<ResolvedMedia> {
      const { provider } = getConfig();
      if (!provider.configured) {
        throw new AppError("provider_not_configured", {
          message: options.setupHint,
          detail: "DOWNLOAD_PROVIDER_BASE_URL is not set",
        });
      }

      const requestUrl =
        provider.method === "GET"
          ? `${provider.baseUrl}?url=${encodeURIComponent(url)}`
          : provider.baseUrl;

      const headers: Record<string, string> = { ...BROWSER_HEADERS, accept: "application/json" };
      if (provider.apiKey) {
        headers[provider.headerName] =
          provider.headerName.toLowerCase() === "authorization"
            ? `Bearer ${provider.apiKey}`
            : provider.apiKey;
      }

      let payload: unknown;
      try {
        payload = await fetchJson(requestUrl, {
          method: provider.method,
          body: provider.method === "POST" ? JSON.stringify({ url }) : undefined,
          headers: provider.method === "POST" ? { ...headers, "content-type": "application/json" } : headers,
          timeoutMs: provider.timeoutMs,
          signal: context?.signal,
          // The resolver is operator-configured, not user supplied, so it may
          // legitimately live on a private network.
          skipPublicCheck: true,
          allowPrivateForTest: true,
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("provider_error");
      }

      const mapped = mapRemoteResponse(payload);
      const formats = cleanFormats(mapped.formats);

      if (formats.length === 0) {
        throw new AppError("not_found", {
          message: "The downloader service returned no playable media for that link.",
        });
      }

      const primary = formats[0]!;
      return {
        id: `${options.id}-${hash(url).toString(36)}`,
        providerId: options.id,
        providerName: options.name,
        platform: options.platform,
        kind: formats.length > 1 && formats.every((f) => f.kind === "image") ? "gallery" : primary.kind,
        title: mapped.title?.slice(0, 180),
        thumbnail: mapped.thumbnail,
        duration: mapped.duration,
        author: mapped.author,
        pageUrl: url,
        formats,
        singleFormat: formats.length === 1,
      };
    },
  };
}

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) >>> 0;
  return out;
}
