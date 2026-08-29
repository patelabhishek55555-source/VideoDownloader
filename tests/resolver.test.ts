import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import {
  formatYtDlpPayload,
  createResolverServer,
  checkYtDlp,
} from "../resolver/server.mjs";
import { mapRemoteResponse, createRemoteApiProvider } from "@/lib/providers/remote-api";
import { resetConfigCache } from "@/lib/config/env";

describe("resolver: yt-dlp payload formatter", () => {
  it("extracts and sorts formats by quality (video with audio first)", () => {
    const rawYtDlp = {
      title: "Cool Adventure Clip",
      uploader: "adventure_channel",
      duration: 35.4,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [
        {
          format_id: "18",
          url: "https://cdn.example.com/360p.mp4",
          ext: "mp4",
          height: 360,
          width: 640,
          vcodec: "avc1",
          acodec: "mp4a",
          filesize: 3_000_000,
        },
        {
          format_id: "22",
          url: "https://cdn.example.com/720p.mp4",
          ext: "mp4",
          height: 720,
          width: 1280,
          vcodec: "avc1",
          acodec: "mp4a",
          filesize: 12_000_000,
        },
        {
          format_id: "137",
          url: "https://cdn.example.com/1080p-novideo.mp4",
          ext: "mp4",
          height: 1080,
          width: 1920,
          vcodec: "avc1",
          acodec: "none",
          filesize: 25_000_000,
        },
        {
          format_id: "140",
          url: "https://cdn.example.com/audio.m4a",
          ext: "m4a",
          vcodec: "none",
          acodec: "mp4a",
          abr: 128,
          filesize: 1_000_000,
        },
      ],
    };

    const formatted = formatYtDlpPayload(rawYtDlp);
    expect(formatted.title).toBe("Cool Adventure Clip");
    expect(formatted.author).toBe("adventure_channel");
    expect(formatted.duration).toBe(35);
    expect(formatted.thumbnail).toBe("https://example.com/thumb.jpg");
    expect(formatted.formats.length).toBeGreaterThan(0);

    // 720p with audio should be ranked above 360p and audio-only
    const first = formatted.formats[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.quality).toBe("720p");
      expect(first.has_audio).toBe(true);
      expect(first.ext).toBe("mp4");
    }

    // Audio format exists
    const audioFormat = formatted.formats.find((f: { ext: string }) => f.ext === "m4a");
    expect(audioFormat).toBeDefined();
  });

  it("falls back to top-level url if formats array is empty", () => {
    const raw = {
      title: "Direct Video",
      url: "https://cdn.example.com/file.mp4",
      filesize: 5000,
      height: 1080,
    };

    const formatted = formatYtDlpPayload(raw);
    expect(formatted.title).toBe("Direct Video");
    expect(formatted.formats).toHaveLength(1);
    const item = formatted.formats[0];
    expect(item).toBeDefined();
    if (item) {
      expect(item.url).toBe("https://cdn.example.com/file.mp4");
      expect(item.quality).toBe("1080p");
    }
  });

  it("feeds into VideoDownloader mapRemoteResponse cleanly", () => {
    const payload = formatYtDlpPayload({
      title: "Viral TikTok",
      uploader: "tiktok_star",
      duration: 15,
      thumbnail: "https://p16-va.tiktokcdn.com/thumb.jpg",
      formats: [
        {
          url: "https://v16-web.tiktokcdn.com/video-hd.mp4",
          height: 1080,
          ext: "mp4",
          vcodec: "h264",
          acodec: "aac",
          filesize: 8_500_000,
        },
      ],
    });

    const mapped = mapRemoteResponse(payload);
    expect(mapped.title).toBe("Viral TikTok");
    expect(mapped.author).toBe("tiktok_star");
    expect(mapped.duration).toBe(15);
    expect(mapped.formats).toHaveLength(1);
    const firstMapped = mapped.formats[0];
    expect(firstMapped).toBeDefined();
    if (firstMapped) {
      expect(firstMapped.url).toBe("https://v16-web.tiktokcdn.com/video-hd.mp4");
      expect(firstMapped.height).toBe(1080);
      expect(firstMapped.quality).toBe("1080p");
    }
  });
});

describe("resolver: checkYtDlp", () => {
  it("detects yt-dlp version if installed in environment", async () => {
    const check = await checkYtDlp();
    expect(check.available).toBe(true);
    expect(check.version).toBeTruthy();
  });
});

describe("resolver: HTTP server integration", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createResolverServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.DOWNLOAD_PROVIDER_BASE_URL;
    resetConfigCache();
  });

  it("returns 200 on /health with service information", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; service: string };
    expect(json.status).toBe("ok");
    expect(json.service).toBe("video-downloader-resolver");
  });

  it("rejects invalid non-URL queries with 400", async () => {
    const res = await fetch(`${baseUrl}/?url=not-a-valid-url`);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_url");
  });

  it("connects with VideoDownloader provider adapter config", async () => {
    process.env.DOWNLOAD_PROVIDER_BASE_URL = baseUrl;
    resetConfigCache();

    const provider = createRemoteApiProvider({
      id: "test-platform",
      name: "Test Platform",
      platform: "test",
      hosts: ["example.com"],
      tagline: "Test videos",
      setupHint: "Set DOWNLOAD_PROVIDER_BASE_URL",
    });

    expect(provider.id).toBe("test-platform");
    expect(provider.requiresConfiguration).toBe(true);
  });
});
