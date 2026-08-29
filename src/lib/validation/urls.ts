/**
 * URL parsing, normalisation and list handling for the bulk input.
 *
 * Everything here is pure and side-effect free so it can run identically in the
 * browser (instant feedback while typing) and on the server (authoritative
 * validation before anything is fetched).
 */

export type UrlParseFailure =
  | { code: "empty"; message: string }
  | { code: "unsupported-scheme"; message: string }
  | { code: "invalid"; message: string }
  | { code: "not-a-link"; message: string };

export type UrlParseResult =
  | { ok: true; url: URL; normalized: string }
  | ({ ok: false } & UrlParseFailure);

const INVALID_URL_MESSAGE = "That doesn't look like a valid video link.";
const UNSUPPORTED_SCHEME_MESSAGE = "Only http and https links are supported.";

/** Query parameters that are pure tracking noise and never affect the media. */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "igsh",
  "igshid",
  "si",
  "feature",
  "ref",
  "ref_src",
  "ref_url",
  "refer",
  "cmpid",
  "share_token",
  "_branch_match_id",
  "tt_from",
  "is_from_webapp",
  "sender_device",
  "sender_web_id",
]);

/** Hosts that can never hold a downloadable public video. */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "example.com",
  "example.org",
  "test",
  "invalid",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
  ".invalid",
  ".test",
  ".lan",
  ".home",
  ".onion",
];

/** Strip smart quotes / zero-width characters that survive a copy-paste. */
export function cleanPastedText(raw: string): string {
  return raw
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u00a0\s]+/g, " ")
    .trim();
}

/** Add a scheme when the user pasted a bare `domain.com/path`. */
function withScheme(raw: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^localhost:/i.test(raw)) return raw;
  return `https://${raw}`;
}

export function parseCandidateUrl(rawInput: string): UrlParseResult {
  const raw = cleanPastedText(rawInput).replace(/^["']|["']$/g, "").trim();

  if (raw.length === 0) {
    return { ok: false, code: "empty", message: "Paste a link to get started." };
  }

  if (raw.length > 2048) {
    return { ok: false, code: "invalid", message: "That link is too long to process." };
  }

  if (!/[.:/]/.test(raw)) {
    return { ok: false, code: "not-a-link", message: INVALID_URL_MESSAGE };
  }

  let url: URL;
  try {
    url = new URL(withScheme(raw));
  } catch {
    return { ok: false, code: "invalid", message: INVALID_URL_MESSAGE };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "unsupported-scheme", message: UNSUPPORTED_SCHEME_MESSAGE };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname.length === 0 || hostname.length > 253) {
    return { ok: false, code: "invalid", message: INVALID_URL_MESSAGE };
  }

  // A host must be either a bracketed/decimal IP or contain a dot — this rejects
  // "http://metadata" style single-label hosts used in SSRF attempts.
  const isIpv6 = url.hostname.startsWith("[");
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (!isIpv6 && !isIpv4 && !hostname.includes(".")) {
    return { ok: false, code: "invalid", message: INVALID_URL_MESSAGE };
  }

  if (BLOCKED_HOSTS.has(hostname) || BLOCKED_HOST_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { ok: false, code: "invalid", message: INVALID_URL_MESSAGE };
  }

  if (!url.pathname || url.pathname === "/") {
    // Bare domains carry no media reference; still syntactically valid though.
    return { ok: true, url, normalized: normaliseUrl(url) };
  }

  return { ok: true, url, normalized: normaliseUrl(url) };
}

/** Canonical form used for duplicate detection and stable filenames. */
export function normaliseUrl(url: URL): string {
  const clone = new URL(url.toString());
  clone.hash = "";
  clone.hostname = clone.hostname.toLowerCase();
  if (clone.hostname.startsWith("www.")) clone.hostname = clone.hostname.slice(4);
  for (const key of [...clone.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) clone.searchParams.delete(key);
  }
  clone.searchParams.sort();
  let path = clone.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  clone.pathname = path;
  if (clone.port === "80" && clone.protocol === "http:") clone.port = "";
  if (clone.port === "443" && clone.protocol === "https:") clone.port = "";
  return clone.toString();
}

export interface ParsedUrlItem {
  id: string;
  raw: string;
  normalized: string;
}

export interface ParsedUrlList {
  valid: ParsedUrlItem[];
  duplicates: string[];
  invalid: { raw: string; message: string }[];
  /** Lines that were ignored because they were plainly not link attempts. */
  ignored: number;
  truncated: boolean;
  totalSeen: number;
}

/**
 * Does this fragment look like somebody tried to paste a link?
 *
 * In a bulk paste, ordinary words ("thanks!", "and this one") should be ignored
 * rather than reported as invalid links. A single-chunk input is always treated
 * as an attempt so a lone typo still gets feedback.
 */
function looksLikeLinkAttempt(chunk: string, isOnlyChunk: boolean): boolean {
  if (isOnlyChunk) return true;
  return chunk.includes("://") || /\.[a-z0-9]{2,}/i.test(chunk);
}

/**
 * Split free-form pasted text into individual links.
 *
 * Accepts one-per-line, comma/space separated, or a single blob of text with
 * embedded URLs. Reports duplicates and invalid entries separately so the UI
 * can show "8 valid • 1 duplicate • 1 invalid".
 */
export function parseUrlList(input: string, limit = 25): ParsedUrlList {
  const text = cleanPastedText(input).replace(/["']/g, " ");

  const chunks = text
    .split(/[\s,;]+|\s*\|\s*/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const seen = new Map<string, string>();
  const valid: ParsedUrlItem[] = [];
  const duplicates: string[] = [];
  const invalid: { raw: string; message: string }[] = [];
  let truncated = false;
  let ignored = 0;

  for (const chunk of chunks) {
    if (!looksLikeLinkAttempt(chunk, chunks.length === 1)) {
      ignored += 1;
      continue;
    }

    // A chunk may still contain a full URL embedded in surrounding prose.
    const embedded = chunk.match(/https?:\/\/[^\s,;'"<>)]+/i);
    const candidate = embedded ? embedded[0] : chunk;
    const parsed = parseCandidateUrl(candidate);

    if (!parsed.ok) {
      invalid.push({ raw: candidate.slice(0, 120), message: parsed.message });
      continue;
    }

    const existing = seen.get(parsed.normalized);
    if (existing) {
      duplicates.push(candidate.slice(0, 120));
      continue;
    }

    if (valid.length >= limit) {
      truncated = true;
      continue;
    }

    const id = makeItemId(parsed.normalized, valid.length);
    seen.set(parsed.normalized, id);
    valid.push({ id, raw: candidate, normalized: parsed.normalized });
  }

  return { valid, duplicates, invalid, ignored, truncated, totalSeen: chunks.length };
}

let idCounter = 0;

/** Short, collision-resistant id for queue items. */
export function makeItemId(seed: string, index: number): string {
  idCounter = (idCounter + 1) % 1_000_000;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `it_${hash.toString(36)}${index.toString(36)}${idCounter.toString(36)}`;
}

export function hostLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
