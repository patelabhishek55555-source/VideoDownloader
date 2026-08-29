import { describe, expect, it } from "vitest";

import {
  assertAllowedHost,
  isBlockedHostname,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
  DEFAULT_ALLOWED_MEDIA_SUFFIXES,
} from "@/lib/security/ssrf";
import {
  cleanPastedText,
  hostLabel,
  normaliseUrl,
  parseCandidateUrl,
  parseUrlList,
} from "@/lib/validation/urls";

describe("ssrf: address classification", () => {
  it("flags every private and reserved IPv4 range", () => {
    const privateIps = [
      "0.0.0.0",
      "10.0.0.1",
      "10.255.255.255",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.1",
      "192.0.2.1",
      "192.168.1.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "255.255.255.255",
    ];
    for (const ip of privateIps) expect(isPrivateIpv4(ip), ip).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "198.17.0.1", "93.184.216.34"]) {
      expect(isPrivateIpv4(ip), ip).toBe(false);
    }
  });

  it("flags private IPv6 forms including mapped IPv4", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("::")).toBe(true);
    expect(isPrivateIpv6("fd12:3456::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("ff02::1")).toBe(true);
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIpv6("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIpv6("64:ff9b::7f00:1")).toBe(false); // public mapped
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false);
  });

  it("dispatches on address family", () => {
    expect(isPrivateAddress("192.168.0.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("::1")).toBe(true);
  });
});

describe("ssrf: host rules", () => {
  it("blocks cloud metadata and internal hostnames", () => {
    for (const host of [
      "metadata.google.internal",
      "metadata",
      "instance-data",
      "localhost",
      "printer.local",
      "api.internal",
      "hidden.onion",
    ]) {
      expect(isBlockedHostname(host), host).toBe(true);
    }
    expect(isBlockedHostname("www.instagram.com")).toBe(false);
  });

  it("rejects non-web schemes, credentials and unusual ports", () => {
    expect(() => assertAllowedHost("file:///etc/passwd")).toThrow();
    expect(() => assertAllowedHost("http://user:pass@example.com/a.mp4")).toThrow(/credentials/);
    expect(() => assertAllowedHost("http://example.com:8080/a.mp4")).toThrow(/ports/);
    expect(() => assertAllowedHost("ftp://example.com/a.mp4")).toThrow();
    expect(() => assertAllowedHost("not a url")).toThrow();
  });

  it("allows standard web ports and both web schemes", () => {
    expect(assertAllowedHost("https://cdn.example.com/a.mp4").protocol).toBe("https:");
    expect(assertAllowedHost("http://cdn.example.com:80/a.mp4").protocol).toBe("http:");
    expect(assertAllowedHost("https://cdn.example.com:443/a.mp4").protocol).toBe("https:");
  });

  it("enforces the media host allowlist when supplied", () => {
    const suffixes = DEFAULT_ALLOWED_MEDIA_SUFFIXES;
    expect(() => assertAllowedHost("https://scontent.cdninstagram.com/a.mp4", { allowedSuffixes: suffixes })).not.toThrow();
    expect(() => assertAllowedHost("https://v16-web.tiktokcdn.com/a.mp4", { allowedSuffixes: suffixes })).not.toThrow();
    expect(() => assertAllowedHost("https://evil-cdninstagram.com/a.mp4", { allowedSuffixes: suffixes })).toThrow(
      /safety/,
    );
    expect(() => assertAllowedHost("https://169.254.169.254/latest/meta-data", { allowedSuffixes: suffixes })).toThrow();
  });
});

describe("url parsing", () => {
  it("accepts well-formed links and normalises them", () => {
    const parsed = parseCandidateUrl("https://www.Instagram.com/reel/ABC123/?igshid=xyz&utm_source=share");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.url.hostname).toBe("www.instagram.com");
      expect(parsed.normalized).toBe("https://instagram.com/reel/ABC123");
    }
  });

  it("adds https:// to bare domains", () => {
    const parsed = parseCandidateUrl("instagram.com/reel/ABC123/");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.url.protocol).toBe("https:");
  });

  it("rejects junk with a friendly message", () => {
    const notALink = parseCandidateUrl("hello there");
    expect(notALink.ok).toBe(false);
    if (!notALink.ok) expect(notALink.message).toBe("That doesn't look like a valid video link.");
  });

  it("rejects unsupported schemes and empty input", () => {
    const scheme = parseCandidateUrl("javascript:alert(1)");
    expect(scheme.ok).toBe(false);
    if (!scheme.ok) expect(scheme.code).toBe("unsupported-scheme");

    const empty = parseCandidateUrl("   ");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("empty");
  });

  it("strips smart quotes and zero-width characters from pastes", () => {
    expect(cleanPastedText("\u201chttps://a.com/b\u201d\u200b")).toBe('"https://a.com/b"');
    expect(parseCandidateUrl("\u201chttps://a.com/b\u201d").ok).toBe(true);
  });

  it("normalises for duplicate detection", () => {
    const a = parseCandidateUrl("https://www.tiktok.com/@user/video/123?utm_source=x");
    const b = parseCandidateUrl("https://tiktok.com/@user/video/123/");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(normaliseUrl(a.url)).toBe(normaliseUrl(b.url));
    }
  });

  it("exposes a readable host label", () => {
    expect(hostLabel("https://www.instagram.com/reel/x/")).toBe("instagram.com");
    expect(hostLabel("nonsense")).toBe("nonsense");
  });
});

describe("bulk url list parsing", () => {
  it("splits newline separated links and counts them", () => {
    const result = parseUrlList(
      [
        "https://instagram.com/reel/AAA/",
        "https://instagram.com/reel/BBB/",
        "https://www.tiktok.com/@user/video/111",
      ].join("\n"),
    );
    expect(result.valid).toHaveLength(3);
    expect(result.invalid).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it("detects duplicates that differ only by tracking parameters", () => {
    const result = parseUrlList(
      [
        "https://instagram.com/reel/AAA/?igshid=abc",
        "https://www.instagram.com/reel/AAA/",
        "https://instagram.com/reel/AAA?utm_source=share",
      ].join("\n"),
    );
    expect(result.valid).toHaveLength(1);
    expect(result.duplicates).toHaveLength(2);
  });

  it("separates invalid entries instead of dropping them silently", () => {
    const result = parseUrlList("https://instagram.com/reel/AAA/\nnot-a-link\nhttps://tiktok.com/@u/video/1\nftp://x.com/a");
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]!.message).toBe("Only http and https links are supported.");
    expect(result.ignored).toBe(1);
  });

  it("always gives feedback for a single mistyped link", () => {
    const result = parseUrlList("htp://instagram.com/reel/AAA/");
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
  });

  it("extracts urls embedded in surrounding prose", () => {
    const result = parseUrlList("check this one https://instagram.com/reel/ZZZ/ thanks!");
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]!.normalized).toBe("https://instagram.com/reel/ZZZ");
  });

  it("respects the bulk limit and reports truncation", () => {
    const lines = Array.from({ length: 30 }, (_unused, i) => `https://cdn.samplevideos.io/video/${i}`);
    const result = parseUrlList(lines.join("\n"), 25);
    expect(result.valid).toHaveLength(25);
    expect(result.truncated).toBe(true);
  });

  it("handles commas, semicolons and pipe separators", () => {
    const result = parseUrlList("https://a.com/1, https://a.com/2; https://a.com/3 | https://a.com/4");
    expect(result.valid).toHaveLength(4);
  });

  it("assigns unique ids to every accepted link", () => {
    const result = parseUrlList("https://a.com/1\nhttps://a.com/2\nhttps://a.com/3");
    const ids = result.valid.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
