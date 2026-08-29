# Video Downloader — Self-Hosted Resolver

This directory contains the optional, standalone **media resolver service** for the Video Downloader web application.

The Video Downloader web app runs on serverless hosting (e.g. Vercel) and natively extracts public direct links, Reddit videos, and web pages with embedded video tags. However, platforms like **Instagram, TikTok, Facebook, Pinterest, and X** use rotating CDNs and complex session-based extraction. This companion service uses **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** to resolve public video metadata into direct media streams, fulfilling the Video Downloader provider contract.

---

## Features

- **Standard HTTP Contract** — Implements `POST /` with `{"url": "..."}` and `GET /?url=...`.
- **Zero NPM Dependencies** — Built with Node.js built-in standard library (`node:http`, `node:child_process`).
- **yt-dlp Powered** — Leverages yt-dlp's video extractors and format analysis.
- **Smart Format Mapping** — Extracts progressive MP4 videos (with audio), HD resolutions (1080p, 720p, etc.), thumbnails, duration, author, and audio-only streams.
- **Security & Auth** — Optional API key authentication via `Authorization: Bearer <token>` or `x-api-key`.
- **Concurrency & Rate Protection** — Built-in concurrency limiter to prevent server overload.
- **Health Check Endpoint** — `/health` reports service status, yt-dlp version, and active request count.
- **Docker & Cloud Ready** — Includes `Dockerfile`, `docker-compose.yml`, `render.yaml`, and `fly.toml`.

---

## Quick Start

### 1. Run with Docker (Recommended)

```bash
cd resolver
docker compose up -d
```

The resolver is now running at `http://localhost:3210`.

### 2. Run with Node.js directly

Prerequisites:
- Node.js >= 18
- `yt-dlp` installed and available in your `PATH` (e.g. `pip install yt-dlp` or `brew install yt-dlp`)

```bash
cd resolver
npm start
```

---

## Connecting to the Video Downloader App

Once your resolver is running, connect it to your main Video Downloader Next.js app by setting the following environment variables in `.env` (or in your Vercel project settings):

```env
# URL where your resolver service is accessible
DOWNLOAD_PROVIDER_BASE_URL=http://localhost:3210

# If you configured an API_KEY on the resolver:
DOWNLOAD_PROVIDER_API_KEY=your-secret-api-key

# Optional: Header name (default: Authorization)
DOWNLOAD_PROVIDER_HEADER_NAME=Authorization

# Optional: HTTP method (POST or GET, default: POST)
DOWNLOAD_PROVIDER_METHOD=POST

# Optional: Resolver timeout in milliseconds (default: 20000)
DOWNLOAD_PROVIDER_TIMEOUT_MS=20000
```

Once configured, Instagram, TikTok, Facebook, Pinterest, and X links will resolve immediately in Video Downloader!

---

## Deployment Options

### Deploy on Fly.io (Free / Cheap)

```bash
cd resolver
fly launch
fly secrets set API_KEY=your-secure-random-token
fly deploy
```

Set in your Next.js app:
```env
DOWNLOAD_PROVIDER_BASE_URL=https://video-downloader-resolver.fly.dev
DOWNLOAD_PROVIDER_API_KEY=your-secure-random-token
```

### Deploy on Render

1. Connect your repository to Render.
2. Create a new **Web Service** selecting the `resolver/Dockerfile` (or use `resolver/render.yaml` as Blueprint).
3. Set environment variable `API_KEY`.
4. Copy the public Render URL to `DOWNLOAD_PROVIDER_BASE_URL` in your Next.js deployment.

### Deploy on Railway

1. New Project → Deploy from GitHub Repo.
2. Set Root Directory to `resolver`.
3. Add variable `PORT=3210` and `API_KEY=your-secret-key`.

### Deploy on a VPS / Linux Server with Systemd

1. Install Python 3, ffmpeg, yt-dlp and Node.js:
   ```bash
   sudo apt update && sudo apt install -y python3 python3-pip ffmpeg nodejs
   sudo pip3 install yt-dlp --break-system-packages
   ```
2. Create `/etc/systemd/system/video-downloader-resolver.service`:
   ```ini
   [Unit]
   Description=Video Downloader Resolver
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/video-downloader/resolver
   ExecStart=/usr/bin/node /opt/video-downloader/resolver/server.mjs
   Restart=always
   Environment=PORT=3210
   Environment=API_KEY=your-secret-key

   [Install]
   WantedBy=multi-user.target
   ```
3. Enable and start:
   ```bash
   sudo systemctl enable --now video-downloader-resolver
   ```

---

## API Specification

### `POST /` or `POST /resolve`
Resolves a video URL to metadata and media streams.

**Request:**
```http
POST / HTTP/1.1
Host: localhost:3210
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "url": "https://www.instagram.com/reel/Cxxxxxx/"
}
```

**Response (200 OK):**
```json
{
  "title": "Sample Reel",
  "thumbnail": "https://scontent.cdninstagram.com/...",
  "duration": 18,
  "author": "creator_name",
  "formats": [
    {
      "quality": "1080p",
      "ext": "mp4",
      "url": "https://scontent.cdninstagram.com/.../video-1080p.mp4",
      "size": 8421000,
      "height": 1080,
      "width": 1920,
      "fps": 30,
      "has_audio": true
    },
    {
      "quality": "720p",
      "ext": "mp4",
      "url": "https://scontent.cdninstagram.com/.../video-720p.mp4",
      "size": 4210500,
      "height": 720,
      "width": 1280,
      "fps": 30,
      "has_audio": true
    }
  ]
}
```

### `GET /?url=<url>`
Resolves a video URL via GET parameter.

### `GET /health`
Returns system status, yt-dlp availability, and health metrics.

```json
{
  "status": "ok",
  "service": "video-downloader-resolver",
  "version": "1.0.0",
  "activeRequests": 0,
  "maxConcurrency": 8,
  "authConfigured": true,
  "ytDlp": {
    "available": true,
    "version": "2026.08.19"
  }
}
```

---

## Configuration Reference

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3210` | Port to listen on |
| `HOST` | `0.0.0.0` | Host interface to bind to |
| `API_KEY` | `""` | Optional secret token required for authentication |
| `HEADER_NAME` | `authorization` | Header to inspect for API key (`authorization` or `x-api-key`) |
| `YT_DLP_PATH` | `yt-dlp` | Path to the yt-dlp executable |
| `TIMEOUT_MS` | `30000` | Max milliseconds to wait for yt-dlp extraction |
| `MAX_CONCURRENCY` | `8` | Maximum concurrent extraction processes |
| `COOKIES_CONTENT` | `""` | Optional Netscape cookies text for authenticated extractions |
| `COOKIES_FILE` | `""` | Optional path to `cookies.txt` file |
