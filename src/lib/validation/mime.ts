/**
 * MIME type mapping.
 *
 * Used to label proxied downloads and to sanity-check that an upstream actually
 * served the kind of file we expect, rather than trusting an extension blindly.
 */

const EXT_TO_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  opus: "audio/ogg",
  ogg: "audio/ogg",
  flac: "audio/flac",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  zip: "application/zip",
};

const TYPE_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function contentTypeForExt(ext: string): string {
  return EXT_TO_TYPE[ext.toLowerCase().replace(/^\./, "")] ?? "application/octet-stream";
}

export function extForContentType(contentType: string | undefined | null): string | undefined {
  if (!contentType) return undefined;
  const base = contentType.split(";")[0]?.trim().toLowerCase();
  return base ? TYPE_TO_EXT[base] : undefined;
}

export function isMediaContentType(contentType: string | undefined | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return base.startsWith("video/") || base.startsWith("audio/") || base.startsWith("image/");
}

/** RFC 6266 Content-Disposition with a UTF-8 filename* fallback. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
