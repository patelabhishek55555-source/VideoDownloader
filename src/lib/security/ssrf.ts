/**
 * SSRF protection.
 *
 * A user-supplied URL must never reach an internal or cloud-metadata address.
 * Two independent layers are applied:
 *
 *  1. A hostname/port allowlist check (`assertAllowedHost`) — the primary
 *     defence, because it is an allowlist rather than a blocklist.
 *  2. DNS resolution with a private-range check on *every* returned address
 *     (`assertPublicTarget`), which catches allowlisted domains that have been
 *     pointed at private space.
 *
 * Note the inherent TOCTOU gap in any DNS-then-connect design: a hostile
 * authoritative server can answer the lookup with a public address and the
 * later connection with a private one. The allowlist layer exists to bound that
 * risk, so endpoints that accept caller-supplied URLs must use it.
 */

import { lookup } from "node:dns/promises";

import { AppError } from "@/lib/errors";

const ALLOWED_PORTS = new Set([80, 443]);

/** IPv4 ranges that must never be fetched. */
const PRIVATE_V4: Array<[number, number]> = [
  [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")], // this network
  [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")], // RFC1918
  [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")], // CGNAT
  [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")], // loopback
  [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")], // link-local + cloud metadata
  [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")], // RFC1918
  [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")], // IETF protocol assignments
  [ipv4ToInt("192.0.2.0"), ipv4ToInt("192.0.2.255")], // TEST-NET-1
  [ipv4ToInt("192.88.99.0"), ipv4ToInt("192.88.99.255")], // 6to4 relay anycast
  [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")], // RFC1918
  [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")], // benchmarking
  [ipv4ToInt("198.51.100.0"), ipv4ToInt("198.51.100.255")], // TEST-NET-2
  [ipv4ToInt("203.0.113.0"), ipv4ToInt("203.0.113.255")], // TEST-NET-3
  [ipv4ToInt("224.0.0.0"), ipv4ToInt("239.255.255.255")], // multicast
  [ipv4ToInt("240.0.0.0"), ipv4ToInt("255.255.255.255")], // reserved + broadcast
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".");
  let value = 0;
  for (const part of parts) value = value * 256 + Number(part);
  return value >>> 0;
}

export function isPrivateIpv4(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return true;
  const parts = ip.split(".").map(Number);
  if (parts.some((part) => part > 255)) return true;
  const value = ipv4ToInt(ip);
  return PRIVATE_V4.some(([low, high]) => value >= low && value <= high);
}

export function isPrivateIpv6(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // unique local
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
    return true; // link-local
  }
  if (value.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible addresses.
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]!);
  if (value.startsWith("::") && /^::(\d{1,3}(?:\.\d{1,3}){3})$/.test(value)) {
    return isPrivateIpv4(value.slice(2));
  }
  // NAT64 well-known prefix.
  const nat64 = value.match(/^64:ff9b::(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (nat64) return isPrivateIpv4(nat64[1]!);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  return ip.includes(":") ? isPrivateIpv6(ip) : isPrivateIpv4(ip);
}

/** Hosts that must never be fetched, whatever DNS says. */
const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "localhost",
]);

const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost", ".lan", ".home", ".onion", ".arpa"];

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host === "169.254.169.254") return true;
  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export interface HostCheckOptions {
  /**
   * Optional allowlist of host suffixes. When provided the host must match one
   * of them, which turns this into a true allowlist check.
   */
  allowedSuffixes?: readonly string[];
  /** Allow the request to skip DNS validation (loopback only, used in tests). */
  allowPrivateForTest?: boolean;
}

/** Validate scheme, userinfo, port and hostname shape of a remote URL. */
export function assertAllowedHost(rawUrl: string | URL, options: HostCheckOptions = {}): URL {
  let url: URL;
  try {
    url = rawUrl instanceof URL ? new URL(rawUrl.toString()) : new URL(rawUrl);
  } catch {
    throw new AppError("invalid_url", { message: "That doesn't look like a valid video link." });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("blocked", { message: "Only http and https links can be fetched." });
  }

  if (url.username || url.password) {
    throw new AppError("blocked", { message: "Links containing credentials are not allowed." });
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) throw new AppError("blocked", { message: "That link has no host." });

  if (isBlockedHostname(host)) {
    throw new AppError("blocked", { message: "This link can't be fetched for safety reasons." });
  }

  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port);
  if (!Number.isFinite(port) || !ALLOWED_PORTS.has(port)) {
    throw new AppError("blocked", { message: "Only standard web ports are allowed." });
  }

  const suffixes = options.allowedSuffixes;
  if (suffixes && suffixes.length > 0) {
    const allowed = suffixes.some((suffix) => {
      const bare = suffix.toLowerCase().replace(/^\./, "").replace(/^\*\./, "");
      return host === bare || host.endsWith(`.${bare}`);
    });
    if (!allowed) {
      throw new AppError("blocked", {
        message: "This link can't be fetched for safety reasons.",
        detail: `host ${host} is not in the allowlist`,
      });
    }
  }

  return url;
}

export interface SafeTarget {
  url: URL;
  addresses: string[];
}

/** Resolve DNS and confirm every answer is a public address. */
export async function assertPublicTarget(
  rawUrl: string | URL,
  options: HostCheckOptions = {},
): Promise<SafeTarget> {
  const url = assertAllowedHost(rawUrl, options);
  const host = url.hostname.replace(/^\[|\]$/g, "");

  // Literal IP addresses skip DNS but still get a range check.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (!options.allowPrivateForTest && isPrivateAddress(host)) {
      throw new AppError("blocked", { message: "This link can't be fetched for safety reasons." });
    }
    return { url, addresses: [host] };
  }

  let addresses: string[];
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    addresses = records.map((record) => record.address);
  } catch {
    throw new AppError("not_found", {
      message: "We couldn't reach that site. Please check the link and try again.",
    });
  }

  if (addresses.length === 0) {
    throw new AppError("not_found", { message: "We couldn't reach that site. Please try again." });
  }

  if (!options.allowPrivateForTest && addresses.some((address) => isPrivateAddress(address))) {
    throw new AppError("blocked", {
      message: "This link can't be fetched for safety reasons.",
      detail: `host ${host} resolves to a non-public address`,
    });
  }

  return { url, addresses };
}

/**
 * Host suffixes this service is willing to fetch media from. Built from the
 * provider registry plus the CDN hosts media is normally served from.
 */
export const DEFAULT_ALLOWED_MEDIA_SUFFIXES: readonly string[] = [
  "cdninstagram.com",
  "instagram.com",
  "fbcdn.net",
  "facebook.com",
  "fb.watch",
  "tiktokcdn.com",
  "tiktok.com",
  "ttcdn.co",
  "pinimg.com",
  "pinterest.com",
  "twimg.com",
  "twitter.com",
  "x.com",
  "vimeo.com",
  "vimeocdn.com",
  "redd.it",
  "reddit.com",
  "redditmedia.com",
  "youtube.com",
  "ytimg.com",
  "googlevideo.com",
  "dailymotion.com",
  "dmcdn.net",
  "twitch.tv",
  "ttvnw.net",
  "streamable.com",
  "gfycat.com",
  "redgifs.com",
  "soundcloud.com",
  "sndcdn.com",
];
