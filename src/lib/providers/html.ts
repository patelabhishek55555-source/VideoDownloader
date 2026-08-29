/**
 * Very small, dependency-free HTML inspection helpers.
 *
 * The generic provider only needs a handful of facts out of a page, so a full
 * DOM parser is not worth the bundle. Every helper is defensive: malformed or
 * truncated markup yields "not found" rather than throwing.
 */

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#47": "/",
};

export function unescapeHtml(value: string): string {
  return value
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      const key = entity.toLowerCase();
      if (ENTITY_MAP[key]) return ENTITY_MAP[key]!;
      if (key.startsWith("#x")) {
        const code = Number.parseInt(key.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (key.startsWith("#")) {
        const code = Number.parseInt(key.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    })
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Read `<meta name|property="key" content="…">` in either attribute order. */
export function metaContent(html: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${escapedKey}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content\\s*=\\s*["'][^"']*["'][^>]*(?:property|name)\\s*=\\s*["']${escapedKey}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const tag = html.match(pattern)?.[0];
    if (!tag) continue;
    const content = tag.match(/content\s*=\s*("([^"]*)"|'([^']*)')/i);
    const value = content?.[2] ?? content?.[3];
    if (value && value.trim()) return unescapeHtml(value);
  }
  return undefined;
}

export function firstMetaContent(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = metaContent(html, key);
    if (value) return value;
  }
  return undefined;
}

export function documentTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1] ? stripTags(unescapeHtml(match[1])) : undefined;
  return title && title.length > 0 ? title.slice(0, 180) : undefined;
}

/** Collect every JSON-LD block and return the VideoObject-ish ones. */
export function jsonLdVideoObjects(html: string): Array<Record<string, unknown>> {
  const blocks = [...html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const found: Array<Record<string, unknown>> = [];

  for (const block of blocks) {
    const raw = unescapeHtml(block[1] ?? "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    collectVideoObjects(parsed, found, 0);
  }

  return found;
}

function collectVideoObjects(node: unknown, out: Array<Record<string, unknown>>, depth: number): void {
  if (depth > 6 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectVideoObjects(item, out, depth + 1);
    return;
  }

  const record = node as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type.map(String) : type ? [String(type)] : [];
  if (types.some((value) => /^VideoObject$/i.test(value) || /^Clip$/i.test(value))) {
    out.push(record);
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectVideoObjects(value, out, depth + 1);
  }
}

/** All candidate media URLs in `<video src>` / `<source src>` order. */
export function inlineMediaSources(html: string): string[] {
  const urls: string[] = [];
  const videoTags = [...html.matchAll(/<video[^>]*>/gi)].map((match) => match[0]);
  const sourceTags = [...html.matchAll(/<source[^>]*>/gi)].map((match) => match[0]);

  for (const tag of [...videoTags, ...sourceTags]) {
    const src = tag.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    const value = src?.[2] ?? src?.[3];
    if (value && /^\s*(https?:)?\/\//i.test(value)) urls.push(unescapeHtml(value));
  }

  return urls;
}

/** Convert a possibly-protocol-relative URL into an absolute one. */
export function absolutise(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return undefined;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return undefined;
  }
}

/** ISO-8601 duration ("PT1M30S") to seconds. */
export function parseIsoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i.exec(value);
  if (!match) return undefined;
  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 86400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
  return total > 0 ? Math.round(total) : undefined;
}
