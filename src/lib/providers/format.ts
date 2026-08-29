/**
 * Normalisation of raw format descriptions into the shape the UI renders.
 *
 * Providers hand back whatever the upstream gave us; this module turns that into
 * a stable `label` / `quality` pair and a deterministic sort order so "1080p MP4"
 * always sits above "720p MP4", and audio-only renditions always sit last.
 */

import type { MediaFormat, MediaKind } from "@/lib/types";
import { extFromUrl } from "@/lib/zip/filename";

/**
 * A provider's raw description of one rendition. Everything except `url` is
 * optional because upstreams vary wildly in what they report; `makeFormat`
 * fills the gaps so the UI always gets a complete `MediaFormat`.
 */
export interface RawFormat {
  url: string;
  ext?: string;
  kind?: MediaKind;
  quality?: string;
  label?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
  id?: string;
}

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "opus", "flac", "ogg"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

export function kindForExtension(ext: string): MediaKind {
  const lower = ext.toLowerCase();
  if (AUDIO_EXTENSIONS.has(lower)) return "audio";
  if (IMAGE_EXTENSIONS.has(lower)) return "image";
  return "video";
}

/** Highest vertical resolution mentioned in a quality string, if any. */
export function heightForQuality(quality: string): number | undefined {
  const match = quality.match(/(\d{3,4})\s*[pk]?/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return value >= 144 && value <= 8000 ? value : undefined;
}

export function qualityLabel(options: {
  quality?: string;
  height?: number;
  ext: string;
  kind?: MediaKind;
}): string {
  const kind = options.kind ?? kindForExtension(options.ext);
  const extLabel = options.ext.toUpperCase();

  if (kind === "audio") return `${options.quality ? `${options.quality} ` : ""}${extLabel}`.trim();
  if (kind === "image") return `Image ${extLabel}`;

  const height = options.height ?? (options.quality ? heightForQuality(options.quality) : undefined);
  if (height) return `${height}p ${extLabel}`;
  return options.quality ? `${options.quality} ${extLabel}` : extLabel;
}

export function makeFormat(raw: RawFormat, index: number): MediaFormat {
  const ext = (raw.ext || extFromUrl(raw.url)).toLowerCase();
  const kind = raw.kind ?? kindForExtension(ext);
  const quality = raw.quality?.trim() || (raw.height ? `${raw.height}p` : kind === "video" ? "Original" : kind);
  const label = raw.label?.trim() || qualityLabel({ quality, height: raw.height, ext, kind });

  return {
    id: raw.id ?? `f${index}`,
    label,
    quality,
    ext,
    kind,
    url: raw.url,
    // Filled in by resolveMediaUrl() once the format is known to be safe.
    token: "",
    fileSize: raw.fileSize,
    width: raw.width,
    height: raw.height,
    fps: raw.fps,
    hasAudio: raw.hasAudio,
  };
}

function rank(format: MediaFormat): number {
  if (format.kind === "video") {
    const height = format.height ?? heightForQuality(format.quality);
    return -(height ?? 0);
  }
  return format.kind === "audio" ? 90_000 : 80_000;
}

/** Best quality first; images and audio-only renditions last. */
export function sortFormats(formats: MediaFormat[]): MediaFormat[] {
  return [...formats].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return (b.fileSize ?? 0) - (a.fileSize ?? 0);
  });
}

/** Drop formats whose URL is unusable, then de-duplicate by URL. */
export function cleanFormats(formats: RawFormat[]): MediaFormat[] {
  const seen = new Set<string>();
  const out: MediaFormat[] = [];

  formats.forEach((raw, index) => {
    if (!raw.url || !/^https?:\/\//i.test(raw.url)) return;
    if (seen.has(raw.url)) return;
    seen.add(raw.url);
    out.push(makeFormat(raw, index));
  });

  return sortFormats(out);
}
