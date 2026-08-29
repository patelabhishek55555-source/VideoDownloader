#!/usr/bin/env node
/**
 * Video Downloader — Self-Hosted Resolver Service
 *
 * A lightweight, production-ready HTTP microservice that extracts direct
 * playable media URLs, titles, thumbnails, durations, and formats using yt-dlp.
 *
 * Implements the Video Downloader provider contract:
 *   POST /          body: { "url": "<media page url>" }
 *   GET /?url=...   query param: url
 *
 * Response contract:
 *   {
 *     "title": "Video title",
 *     "thumbnail": "https://...",
 *     "duration": 42,
 *     "author": "username",
 *     "formats": [
 *       { "quality": "1080p", "ext": "mp4", "url": "https://...", "size": 12345678, "height": 1080, "width": 1920, "has_audio": true, "fps": 30 }
 *     ]
 *   }
 */

import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || process.env.RESOLVER_PORT || 3210);
const HOST = process.env.HOST || "0.0.0.0";
const API_KEY = process.env.API_KEY || process.env.DOWNLOAD_PROVIDER_API_KEY || "";
const HEADER_NAME = (process.env.HEADER_NAME || process.env.DOWNLOAD_PROVIDER_HEADER_NAME || "authorization").toLowerCase();
const YT_DLP_PATH = process.env.YT_DLP_PATH || "yt-dlp";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30_000);
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 8);
const COOKIES_CONTENT = process.env.COOKIES_CONTENT || "";
const COOKIES_FILE = process.env.COOKIES_FILE || "";

let activeRequests = 0;
let ytDlpCachedVersion = null;

// Write cookies from env if provided
let resolvedCookiesPath = COOKIES_FILE;
if (!resolvedCookiesPath && COOKIES_CONTENT) {
  try {
    resolvedCookiesPath = join(tmpdir(), `ytdlp-cookies-${process.pid}.txt`);
    writeFileSync(resolvedCookiesPath, COOKIES_CONTENT, { mode: 0o600 });
  } catch (err) {
    console.warn("[resolver] Warning: failed to write cookies file:", err);
  }
}

// Cleanup on exit
process.on("exit", () => {
  if (COOKIES_CONTENT && resolvedCookiesPath && existsSync(resolvedCookiesPath)) {
    try { unlinkSync(resolvedCookiesPath); } catch {}
  }
});

/** Check yt-dlp binary presence and version */
export async function checkYtDlp() {
  if (ytDlpCachedVersion) return { available: true, version: ytDlpCachedVersion };
  try {
    const { stdout } = await execFileAsync(YT_DLP_PATH, ["--version"], { timeout: 5000 });
    ytDlpCachedVersion = stdout.trim();
    return { available: true, version: ytDlpCachedVersion };
  } catch {
    // Try fallback to python3 -m yt_dlp
    try {
      const { stdout } = await execFileAsync("python3", ["-m", "yt_dlp", "--version"], { timeout: 5000 });
      ytDlpCachedVersion = stdout.trim();
      return { available: true, version: ytDlpCachedVersion, pythonModule: true };
    } catch {
      return { available: false, version: null };
    }
  }
}

/** Check request authorization */
function isAuthorized(req) {
  if (!API_KEY) return true; // No key configured -> open

  const authHeader = req.headers[HEADER_NAME] || req.headers["authorization"] || req.headers["x-api-key"];
  if (!authHeader) return false;

  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : String(authHeader).trim();

  return token === API_KEY;
}

/** Sanitize and map raw yt-dlp JSON format objects into our contract */
export function formatYtDlpPayload(info) {
  if (!info || typeof info !== "object") {
    throw new Error("Invalid metadata payload");
  }

  const title = String(info.title || info.fulltitle || "Video").trim();
  const thumbnail = String(
    info.thumbnail ||
    (Array.isArray(info.thumbnails) && info.thumbnails.length > 0
      ? info.thumbnails[info.thumbnails.length - 1].url
      : "")
  ).trim();
  const duration = typeof info.duration === "number" && info.duration > 0 ? Math.round(info.duration) : undefined;
  const author = String(info.uploader || info.channel || info.creator || info.uploader_id || info.artist || "").trim();

  const rawFormats = Array.isArray(info.formats) ? info.formats : [];
  const candidateFormats = [];

  for (const f of rawFormats) {
    if (!f || typeof f !== "object" || !f.url) continue;
    const url = String(f.url).trim();
    if (!/^https?:\/\//i.test(url)) continue;

    // Reject streaming manifest URLs (m3u8/mpd) if direct stream is wanted,
    // but keep progressive direct HTTP/HTTPS files.
    const protocol = String(f.protocol || "").toLowerCase();
    const isManifest = protocol.includes("m3u8") || protocol.includes("m3u") || protocol.includes("dash") || url.includes(".m3u8") || url.includes(".mpd");
    if (isManifest && rawFormats.some((x) => x.url && !x.url.includes(".m3u8") && !x.url.includes(".mpd") && /https?:\/\//i.test(x.url))) {
      // Skip manifest if direct progressive files exist
      continue;
    }

    const hasAudio = f.acodec && f.acodec !== "none" && f.acodec !== "null";
    const hasVideo = f.vcodec && f.vcodec !== "none" && f.vcodec !== "null";
    const height = typeof f.height === "number" && f.height > 0 ? f.height : undefined;
    const width = typeof f.width === "number" && f.width > 0 ? f.width : undefined;
    const fps = typeof f.fps === "number" && f.fps > 0 ? f.fps : undefined;
    const size = typeof f.filesize === "number" && f.filesize > 0
      ? f.filesize
      : typeof f.filesize_approx === "number" && f.filesize_approx > 0
        ? f.filesize_approx
        : undefined;

    let ext = String(f.ext || "").toLowerCase();
    if (!ext || ext === "unknown_video") {
      ext = hasVideo ? "mp4" : "m4a";
    }

    let quality = "";
    if (height) {
      quality = `${height}p`;
    } else if (f.format_note && typeof f.format_note === "string") {
      quality = f.format_note.trim();
    } else if (f.resolution && typeof f.resolution === "string") {
      quality = f.resolution.trim();
    } else if (!hasVideo && hasAudio) {
      quality = f.abr ? `${Math.round(f.abr)}kbps` : "Audio";
    } else {
      quality = "Original";
    }

    candidateFormats.push({
      quality,
      ext,
      url,
      size,
      height,
      width,
      fps,
      has_audio: Boolean(hasAudio),
      has_video: Boolean(hasVideo),
      tbr: typeof f.tbr === "number" ? f.tbr : 0,
    });
  }

  // If no formats were found in info.formats, check top-level direct url
  if (candidateFormats.length === 0 && info.url && /^https?:\/\//i.test(info.url)) {
    const ext = String(info.ext || "mp4").toLowerCase();
    candidateFormats.push({
      quality: info.height ? `${info.height}p` : "Original",
      ext,
      url: String(info.url).trim(),
      size: typeof info.filesize === "number" ? info.filesize : undefined,
      height: typeof info.height === "number" ? info.height : undefined,
      width: typeof info.width === "number" ? info.width : undefined,
      has_audio: true,
      has_video: true,
    });
  }

  // Deduplicate and rank formats
  // Priority: Progressive video (video+audio) sorted by resolution desc, then video-only, then audio-only
  const dedupeKey = (f) => `${f.height || 0}-${f.ext}-${f.has_audio ? 1 : 0}-${f.has_video ? 1 : 0}`;
  const seen = new Set();
  const sorted = [...candidateFormats].sort((a, b) => {
    // 1. Video with audio first
    const aFull = a.has_video && a.has_audio ? 2 : a.has_video ? 1 : 0;
    const bFull = b.has_video && b.has_audio ? 2 : b.has_video ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;

    // 2. Highest vertical resolution
    const hDiff = (b.height || 0) - (a.height || 0);
    if (hDiff !== 0) return hDiff;

    // 3. Prefer mp4 over other extensions
    if (a.ext === "mp4" && b.ext !== "mp4") return -1;
    if (b.ext === "mp4" && a.ext !== "mp4") return 1;

    // 4. Higher bitrate/size
    return (b.size || b.tbr || 0) - (a.size || a.tbr || 0);
  });

  const finalFormats = [];
  for (const f of sorted) {
    const key = dedupeKey(f);
    if (seen.has(key) && finalFormats.length > 0) continue;
    seen.add(key);
    finalFormats.push({
      quality: f.quality,
      ext: f.ext,
      url: f.url,
      size: f.size,
      height: f.height,
      width: f.width,
      fps: f.fps,
      has_audio: f.has_audio,
    });
  }

  return {
    title,
    thumbnail,
    duration,
    author,
    formats: finalFormats,
  };
}

/** Execute yt-dlp on a target URL and parse JSON result */
export async function resolveWithYtDlp(targetUrl) {
  const ytdlpCheck = await checkYtDlp();
  const cmd = ytdlpCheck.pythonModule ? "python3" : YT_DLP_PATH;
  const initialArgs = ytdlpCheck.pythonModule ? ["-m", "yt_dlp"] : [];

  const args = [
    ...initialArgs,
    "--dump-json",
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificates",
    "--geo-bypass",
    "--skip-download",
    "--no-call-home",
  ];

  if (resolvedCookiesPath && existsSync(resolvedCookiesPath)) {
    args.push("--cookies", resolvedCookiesPath);
  }

  args.push(targetUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Resolution timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to execute yt-dlp: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const errorMsg = (stderr || stdout).trim();
        if (/private|login|sign in|restricted|age gate|not available in your/i.test(errorMsg)) {
          const err = new Error(errorMsg || "This media is private or restricted.");
          err.code = "PRIVATE_CONTENT";
          return reject(err);
        }
        if (/not found|404|does not exist|removed|deleted|unavailable/i.test(errorMsg)) {
          const err = new Error(errorMsg || "Media not found or deleted.");
          err.code = "NOT_FOUND";
          return reject(err);
        }
        return reject(new Error(errorMsg || `yt-dlp exited with code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const mapped = formatYtDlpPayload(parsed);
        if (!mapped.formats || mapped.formats.length === 0) {
          const err = new Error("No playable formats returned");
          err.code = "NOT_FOUND";
          return reject(err);
        }
        resolve(mapped);
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp output: ${err.message}`));
      }
    });
  });
}

/** HTTP request handler */
export async function handleRequest(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Health check endpoint
  if (reqUrl.pathname === "/health" || (reqUrl.pathname === "/" && req.method === "GET" && !reqUrl.searchParams.has("url"))) {
    const ytdlpInfo = await checkYtDlp();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      service: "video-downloader-resolver",
      version: "1.0.0",
      activeRequests,
      maxConcurrency: MAX_CONCURRENCY,
      authConfigured: Boolean(API_KEY),
      ytDlp: ytdlpInfo,
    }, null, 2));
    return;
  }

  // Check auth
  if (!isAuthorized(req)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", message: "Invalid or missing API key." }));
    return;
  }

  // Check concurrency limit
  if (activeRequests >= MAX_CONCURRENCY) {
    res.writeHead(429, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "rate_limited", message: "Server is busy. Please retry in a few seconds." }));
    return;
  }

  // Extract target URL from GET or POST
  let targetUrl = "";

  if (req.method === "GET") {
    targetUrl = reqUrl.searchParams.get("url") || "";
    await processUrl(targetUrl, res);
  } else if (req.method === "POST") {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) {
        req.destroy();
      }
    });
    req.on("end", async () => {
      try {
        const json = JSON.parse(body || "{}");
        targetUrl = json.url || "";
      } catch {
        targetUrl = "";
      }
      await processUrl(targetUrl, res);
    });
  } else {
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
}

async function processUrl(targetUrl, res) {
  if (!targetUrl || typeof targetUrl !== "string" || !/^https?:\/\//i.test(targetUrl.trim())) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "invalid_url", message: "A valid http/https URL is required." }));
    return;
  }

  activeRequests += 1;
  try {
    const result = await resolveWithYtDlp(targetUrl.trim());
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    const code = err.code || "PROVIDER_ERROR";
    const statusCode = code === "NOT_FOUND" ? 404 : code === "PRIVATE_CONTENT" ? 403 : 500;
    res.writeHead(statusCode, { "content-type": "application/json" });
    res.end(JSON.stringify({
      error: code.toLowerCase(),
      message: err.message || "Failed to resolve media URL.",
    }));
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
  }
}

/** Create and export the HTTP server instance */
export function createResolverServer() {
  return createServer(handleRequest);
}

// Auto-run if executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ""))) {
  const server = createResolverServer();
  server.listen(PORT, HOST, async () => {
    const ytdlp = await checkYtDlp();
    console.log(`[resolver] Video Downloader Resolver running at http://${HOST}:${PORT}`);
    console.log(`[resolver] yt-dlp status: ${ytdlp.available ? `available (version ${ytdlp.version})` : "NOT FOUND (please install yt-dlp)"}`);
    console.log(`[resolver] Auth: ${API_KEY ? "API key enabled" : "open (no API key required)"}`);
  });
}
