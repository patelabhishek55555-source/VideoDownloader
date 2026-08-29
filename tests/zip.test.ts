import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

import { Crc32, crc32 } from "@/lib/zip/crc32";
import { buildZipBuffer, streamZip } from "@/lib/zip/zip-writer";
import {
  defaultArchiveName,
  extFromUrl,
  formatBytes,
  formatDuration,
  sanitiseArchiveName,
  sanitiseFilename,
  uniqueFileNames,
} from "@/lib/zip/filename";

const scratch: string[] = [];
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function entry(filename: string, contents: string) {
  return {
    filename,
    data: () =>
      (async function* () {
        yield new TextEncoder().encode(contents);
      })(),
  };
}

function entryInChunks(filename: string, chunks: string[]) {
  return {
    filename,
    data: () =>
      (async function* () {
        for (const chunk of chunks) yield new TextEncoder().encode(chunk);
      })(),
  };
}

async function drain(gen: AsyncGenerator<Uint8Array, void, void>): Promise<void> {
  for await (const _chunk of gen) {
    /* drain */
  }
}

describe("crc32", () => {
  it("matches the reference CRC-32 test vector", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });

  it("is zero for an empty payload", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("is identical when computed incrementally across chunks", () => {
    const whole = crc32(new TextEncoder().encode("the quick brown fox"));
    const incremental = new Crc32()
      .update(new TextEncoder().encode("the quick "))
      .update(new TextEncoder().encode("brown fox"))
      .digest();
    expect(incremental).toBe(whole);
  });
});

describe("zip writer", () => {
  it("produces an archive unzip extracts byte-for-byte", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-test-"));
    scratch.push(dir);
    const zipPath = join(dir, "out.zip");

    const buffer = await buildZipBuffer([
      entry("video-01.mp4", "hello world"),
      entryInChunks("nested/video-02.mp4", ["chunk-one-", "chunk-two-", "chunk-three"]),
    ]);
    writeFileSync(zipPath, buffer);

    const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
    expect(listing).toContain("video-01.mp4");
    expect(listing).toContain("nested/video-02.mp4");

    const testOutput = execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" });
    expect(testOutput).toContain("No errors detected");

    execFileSync("unzip", ["-o", zipPath, "-d", join(dir, "out")]);
    expect(readFileSync(join(dir, "out/video-01.mp4"), "utf8")).toBe("hello world");
    expect(readFileSync(join(dir, "out/nested/video-02.mp4"), "utf8")).toBe(
      "chunk-one-chunk-two-chunk-three",
    );
  });

  it("verifies with Python's zipfile implementation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-test-py-"));
    scratch.push(dir);
    const zipPath = join(dir, "out.zip");

    const payload = "A".repeat(70_000);
    const buffer = await buildZipBuffer([entry("big.bin", payload), entry("empty.txt", "")]);
    writeFileSync(zipPath, buffer);

    const script = `
import sys, zipfile, hashlib
path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    names = z.namelist()
    data = z.read("big.bin")
    print(names[0], len(data), hashlib.sha256(data).hexdigest()[:16], z.read("empty.txt") == b"")
`;
    const out = execFileSync("python3", ["-c", script, zipPath], { encoding: "utf8" }).trim();
    const [first, length, , emptyOk] = out.split(" ");
    expect(first).toBe("big.bin");
    expect(Number(length)).toBe(70_000);
    expect(emptyOk).toBe("True");
  });

  it("reports per-entry progress while streaming", async () => {
    const started: string[] = [];
    const ended: Array<[string, number]> = [];
    await drain(
      streamZip([entry("a.mp4", "aaaa"), entry("b.mp4", "bbbbbb")], {
        onEntryStart: (_i, filename) => started.push(filename),
        onEntryEnd: (_i, filename, total) => ended.push([filename, total]),
      }),
    );
    expect(started).toEqual(["a.mp4", "b.mp4"]);
    expect(ended.map(([name]) => name)).toEqual(["a.mp4", "b.mp4"]);
    expect(ended[1]![1]).toBeGreaterThan(ended[0]![1]);
  });

  it("enforces the maximum archive size", async () => {
    await expect(drain(streamZip([entry("a.bin", "0123456789")], { maxTotalBytes: 5 }))).rejects.toThrow(
      /maximum allowed size/,
    );
  });

  it("supports non-ASCII entry names via the UTF-8 flag", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-test-utf8-"));
    scratch.push(dir);
    const zipPath = join(dir, "out.zip");
    writeFileSync(zipPath, await buildZipBuffer([entry("café-vidéo-01.mp4", "ok")]));
    expect(execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" })).toContain(
      "No errors detected",
    );
  });

  it("rejects more entries than ZIP can index", async () => {
    const entries = Array.from({ length: 65_537 }, (_unused, i) => entry(`f-${i}.txt`, "x"));
    await expect(drain(streamZip(entries))).rejects.toThrow(/at most 65535 files/);
  });
});

describe("filename sanitising", () => {
  it("slugifies titles with emoji and punctuation", () => {
    expect(sanitiseFilename("My Awesome Video! 🔥", { ext: "mp4" })).toBe("my-awesome-video.mp4");
  });

  it("removes illegal filesystem characters and path separators", () => {
    const name = sanitiseFilename('a/b\\c:d*e?f"g<h>i|j', { ext: "mp4" });
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
    expect(name.endsWith(".mp4")).toBe(true);
  });

  it("falls back when a title sanitises to nothing", () => {
    expect(sanitiseFilename("🔥🔥🔥", { fallback: "video", ext: "mp4" })).toBe("video.mp4");
    expect(sanitiseFilename("", { fallback: "reel", ext: "mp4" })).toBe("reel.mp4");
    expect(sanitiseFilename(null, { fallback: "clip", ext: "mov" })).toBe("clip.mov");
  });

  it("avoids Windows reserved device names", () => {
    expect(sanitiseFilename("CON", { ext: "mp4" })).toBe("con-file.mp4");
  });

  it("truncates long titles before the extension", () => {
    const long = "word ".repeat(60).trim();
    const name = sanitiseFilename(long, { ext: "mp4", maxLength: 40 });
    expect(name.length).toBeLessThanOrEqual(44);
    expect(name.endsWith(".mp4")).toBe(true);
  });

  it("de-duplicates names with a numeric suffix", () => {
    expect(uniqueFileNames(["video.mp4", "video.mp4", "video.mp4", "other.mp4"])).toEqual([
      "video.mp4",
      "video-2.mp4",
      "video-3.mp4",
      "other.mp4",
    ]);
  });

  it("de-duplicates case-insensitively", () => {
    expect(uniqueFileNames(["Video.MP4", "video.mp4"])).toEqual(["Video.MP4", "video-2.mp4"]);
  });

  it("forces a .zip extension on archive names", () => {
    expect(sanitiseArchiveName("My Trip!")).toBe("my-trip.zip");
    expect(sanitiseArchiveName("already.zip")).toBe("already.zip");
    expect(sanitiseArchiveName(undefined)).toBe("video-downloads.zip");
    expect(defaultArchiveName(new Date("2026-08-29T12:00:00Z"))).toBe("video-downloads-2026-08-29.zip");
  });

  it("extracts only known media extensions from URLs", () => {
    expect(extFromUrl("https://cdn.example.com/a/b/file.MP4?x=1")).toBe("mp4");
    expect(extFromUrl("https://cdn.example.com/a/b/video")).toBe("mp4");
    expect(extFromUrl("https://cdn.example.com/a/b/page.php")).toBe("mp4");
    expect(extFromUrl(undefined, "jpg")).toBe("jpg");
  });

  it("formats sizes and durations", () => {
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(undefined)).toBe("—");
  });
});
