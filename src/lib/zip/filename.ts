/**
 * Filesystem-safe filename generation.
 *
 * Turns arbitrary media titles ("My Awesome Video! 🔥") into predictable,
 * deduplicated names ("my-awesome-video.mp4", "my-awesome-video-2.mp4").
 */

const WINDOWS_RESERVED = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

/** Illegal on at least one common filesystem, or unsafe inside a ZIP entry. */
const ILLEGAL_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;

const EXTENSION_PATTERN = /^\.?(mp4|webm|mov|m4v|mkv|avi|mp3|m4a|aac|wav|opus|flac|jpg|jpeg|png|webp|gif|zip)$/i;

export interface SanitiseOptions {
  /** Used when the title sanitises down to nothing. */
  fallback?: string;
  /** Extension without the dot. When set it is always appended. */
  ext?: string;
  /** Maximum length of the name *excluding* the extension. */
  maxLength?: number;
  /** Keep the original casing (ZIP entries look better lower-cased by default). */
  preserveCase?: boolean;
}

/** Convert a title into a safe basename (no extension handling unless `ext` is set). */
export function sanitiseFilename(input: string | undefined | null, options: SanitiseOptions = {}): string {
  const { fallback = "video", ext, maxLength = 80, preserveCase = false } = options;

  let name = typeof input === "string" ? input : "";

  // Strip combining marks, emoji and other pictographs.
  name = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");

  name = name.replace(ILLEGAL_CHARACTERS, " ");
  // Keep letters and digits of any script; everything else (punctuation, emoji
  // remnants, separators) collapses into a single dash.
  name = name.replace(/[^\p{L}\p{N}]+/gu, "-");
  name = name.replace(/-{2,}/g, "-");
  name = name.replace(/^-+|-+$/g, "");

  if (!preserveCase) name = name.toLowerCase();

  if (name.length > maxLength) {
    name = name.slice(0, maxLength);
    name = name.replace(/-+$/g, "");
  }

  if (!name || !/[a-z0-9]/i.test(name)) name = fallback;
  name = name.replace(/^\.+/, "");
  if (WINDOWS_RESERVED.has(name.toLowerCase())) name = `${name}-file`;

  if (ext) {
    const cleanExt = ext.replace(/^\./, "").toLowerCase();
    if (cleanExt && !name.toLowerCase().endsWith(`.${cleanExt}`)) {
      name = `${name}.${cleanExt}`;
    }
  }

  return name.slice(0, 200);
}

/** Pull an extension out of a URL path or a filename, validated against a known list. */
export function extFromUrl(url: string | undefined, fallback = "mp4"): string {
  if (!url) return fallback;
  try {
    const { pathname } = new URL(url, "https://example.invalid");
    const last = pathname.split("/").pop() ?? "";
    const match = last.match(/\.([a-z0-9]{2,5})$/i);
    if (match && EXTENSION_PATTERN.test(match[1]!)) return match[1]!.toLowerCase();
  } catch {
    /* fall through */
  }
  return fallback;
}

export function isKnownMediaExtension(ext: string): boolean {
  return EXTENSION_PATTERN.test(ext);
}

/**
 * De-duplicate a list of names while preserving order.
 * `video.mp4, video.mp4` → `video.mp4, video-2.mp4`.
 */
export function uniqueFileNames(names: string[]): string[] {
  const used = new Map<string, number>();
  const out: string[] = [];

  for (const name of names) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    const key = name.toLowerCase();
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);

    if (count === 0) {
      out.push(name);
      continue;
    }

    let candidate = `${base}-${count + 1}${ext}`;
    let suffix = count + 1;
    while (used.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${base}-${suffix}${ext}`;
    }
    used.set(candidate.toLowerCase(), 1);
    out.push(candidate);
  }

  return out;
}

/** Sanitise a user supplied ZIP name, forcing exactly one `.zip` extension. */
export function sanitiseArchiveName(input: string | undefined): string {
  const trimmed = typeof input === "string" ? input.replace(/\.zip\s*$/i, "") : input;
  return `${sanitiseFilename(trimmed, { fallback: "video-downloads", maxLength: 60 })}.zip`;
}

/** ISO date in YYYY-MM-DD, used for default archive names. */
export function todayStamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function defaultArchiveName(date: Date = new Date()): string {
  return `video-downloads-${todayStamp(date)}.zip`;
}

export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const decimals = exponent === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
