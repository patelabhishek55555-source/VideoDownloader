# Video Downloader

**Download Videos. Save Them Your Way.**

A production-ready, modular web application for saving videos you have the right to keep. Paste one link or a
whole list, pick a quality where the source offers one, and take the results back as a single file, a controlled
sequential run, or one ZIP archive.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS** and designed for serverless deployment on Vercel.

> **Read this first:** the tool only resolves media that a source publishes publicly. It does not bypass logins,
> private accounts, age gates, DRM or any other access control, and it never asks for a social media password.
> Platforms that require an external resolver report "Downloader service is not configured" when one is absent —
> the UI never pretends a download button works when it cannot.

---

## Features

- **Bulk download** — paste one URL per line; duplicates and invalid links are flagged before processing.
- **Download queue** — every link becomes a card with thumbnail, title, quality menu, live status and progress.
- **Quality selection** — the menu only lists renditions the source actually publishes (resolution / format / size).
- **Sequential downloads** — one file at a time through a controlled queue, with "downloading N of M" feedback.
- **ZIP export** — stream a whole batch as a single archive with safe, de-duplicated filenames.
- **Job system** — bulk work runs as a server-side job with bounded concurrency and time budget; resumable across
  requests, and Redis-backed for multi-instance deployments.
- **No account required** — no sign-up, no email, no social login.
- **Mobile-first** — full-width input, stacked queue, sticky bottom controls.
- **Dark / light themes** — dark by default, with a visible toggle and per-user persistence.
- **SEO** — platform landing pages, sitemap, robots, Open Graph + Twitter cards, generated OG image, JSON-LD.
- **PWA-ready** — web manifest, icons and installability (downloads still require the network; nothing works offline).

## Tech stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Framework  | Next.js 15 (App Router), React 19, TypeScript (strict)     |
| Styling    | Tailwind CSS 3, design tokens, `tailwindcss-animate`       |
| Components | shadcn-style primitives on Radix (Select, Accordion, Slot) |
| Icons      | Lucide + original, geometric platform marks                |
| Tests      | Vitest (unit + HTTP-route integration)                     |
| ZIP        | Dependency-free streaming writer (CRC-32 + ZIP64-safe)     |
| Deploy     | Vercel (serverless) or any Node 20.11+ host                |

## Architecture

```
src/
  app/                  # pages + API routes
    api/
      resolve/          # POST {url} -> signed media metadata
      jobs/             # POST bulk job   GET /:id   POST /:id/continue
      zip/              # POST -> streams a ZIP
      zip/store/        # POST -> builds ZIP in object storage, returns temp URL
      download/         # GET ?url&token&name -> streams one file
      health/           # capability summary (no secrets)
  components/
    ui/                 # button, card, select, accordion, toast, progress…
    site/               # header, footer, theme, analytics
    downloader/         # queue UI + the client state machine (use-downloader)
    home/, landing/     # marketing + platform landing pages
  lib/
    config/             # typed env access with safe defaults
    providers/          # per-platform adapters behind one interface
    downloaders/        # resolveMediaUrl, job engine
    security/           # ssrf, tokens, rate limit, safe fetch
    storage/            # job store (memory/redis), object store (s3)
    zip/                # crc32, streaming writer, filenames, size math
    validation/         # url parsing, mime
    seo/                # copy, metadata, landing pages, json-ld
```

### Provider model

Every platform is an adapter implementing one interface, so adding a source is adding a file and registering it:

```
match(url)                 // does this provider own the URL?
resolve(url) -> ResolvedMedia
```

A `ResolvedMedia` carries a `formats[]` list; each format is stamped with a short-lived HMAC token so the proxy
endpoints only ever fetch URLs this service handed out (they can never be repurposed as an open proxy).

- **Direct media** — any URL pointing at a media file. Always works.
- **Reddit** — public posts via Reddit's own JSON API. Always works, no credentials.
- **Web page** — pages that publish `og:video`, JSON-LD `VideoObject` or an inline `<video>` file. Always works.
- **Remote resolver** — Instagram, TikTok, Facebook, Pinterest and X are served by an external service implementing
  the contract below. Unconfigured, they fail honestly with `provider_not_configured`.

### Downloader provider contract

`POST {DOWNLOAD_PROVIDER_BASE_URL}` with `{"url": "…"}` (or `GET ?url=` when `DOWNLOAD_PROVIDER_METHOD=GET`):

```json
{
  "title": "…",
  "thumbnail": "https://…",
  "duration": 34,
  "author": "…",
  "formats": [
    { "quality": "1080p", "ext": "mp4", "url": "https://cdn…/file.mp4", "size": 12345678 }
  ]
}
```

Any HTTP service returning that shape works. A ready-to-deploy, yt-dlp-powered self-hosted resolver companion is included in the [`resolver/`](./resolver) directory with Docker and cloud deployment configs.

## Self-hosted resolver companion

An optional, standalone resolver microservice is included in [`resolver/`](./resolver):

- **Local:** `npm run resolver` (or `cd resolver && npm start`)
- **Docker:** `cd resolver && docker compose up -d`
- **Cloud:** Ready to deploy on Fly.io, Render, Railway, or VPS.

Once running, point your Next.js app to it via:
```env
DOWNLOAD_PROVIDER_BASE_URL=http://localhost:3210
DOWNLOAD_PROVIDER_API_KEY=your-secret-key  # if API_KEY was set in resolver
```
See [`resolver/README.md`](./resolver/README.md) for full setup instructions.

## Getting started

```bash
npm install
cp .env.example .env     # optional — every variable has a safe default
npm run dev              # http://localhost:3000
```

### Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm start          # serve the build
npm run lint       # eslint (flat config)
npm run typecheck  # tsc --noEmit (strict)
npm run test       # vitest unit + integration
npm run check      # lint + typecheck + test + build
```

## Environment variables

All optional. See `.env.example` for the full documented list.

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for SEO/OG/sitemap. Defaults from Vercel or localhost. |
| `DOWNLOAD_PROVIDER_BASE_URL` | External resolver for Instagram/TikTok/Facebook/Pinterest/X. |
| `DOWNLOAD_PROVIDER_API_KEY` / `_HEADER_NAME` / `_METHOD` / `_TIMEOUT_MS` | Resolver auth and behaviour. |
| `TOKEN_SECRET` | HMAC secret for signed media URLs. **Set in production.** Ephemeral otherwise. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Shared job store for multi-instance. In-process otherwise. |
| `OBJECT_STORE_*` | Optional S3-compatible temporary storage for `/api/zip/store`. |
| `MEDIA_HOST_ALLOWLIST` | Optional extra host allowlist for the proxy endpoints (`default` = built-in CDN list). |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_PER_DAY` | Abuse protection. |
| `MAX_BULK_URLS`, `PROCESS_CONCURRENCY`, `JOB_PROCESS_BUDGET_MS` | Bulk processing limits. |
| `MAX_FILE_SIZE_BYTES`, `MAX_ZIP_SIZE_BYTES`, `MAX_ZIP_ENTRIES` | Payload caps. |

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the repository. Framework preset is auto-detected as Next.js.
3. Add any environment variables you want (the app is fully functional for direct/Reddit/web links with none).
4. Deploy. `vercel.json` sets the framework and region; per-route `maxDuration` values are kept within the Hobby
   plan. On Pro you may raise `maxDuration` for `/api/zip` to handle very large archives.

## GitHub setup

The project is a standard Next.js repository. CI-friendly: `npm run check` runs lint, typecheck, tests and build.
No secrets are committed — `.env*` are gitignored and `.env.example` ships empty.

## Security notes

- **URL validation** — scheme (http/https only), host shape, port and length checks.
- **SSRF protection** — host allowlist + DNS resolution with private/loopback/metadata-range rejection.
- **Signed URLs** — proxy endpoints only fetch HMAC-signed URLs this service issued.
- **Rate limiting** — per-IP window + daily quota, configurable, Redis-backed when configured.
- **Streaming, capped bodies** — nothing large is buffered in a function; byte caps enforced.
- **Safe filenames** — sanitised, de-duplicated, extension validated.
- **Headers** — CSP-adjacent hardening, `X-Content-Type-Options`, `X-Frame-Options`, HSTS, `X-Robots-Tag` on APIs.

## Limitations

- Adaptive (HLS/DASH) streams cannot be packaged into a single file and are reported as unsupported.
- Private, removed, quarantined or age-gated content is never fetched.
- On a multi-instance Hobby deploy without Redis, a job created on one instance is invisible to another; the client
  transparently finishes those links in the browser.
- Very large archives should use `/api/zip/store` (object storage) rather than streaming through one function.

## Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| "Downloader service is not configured" | Set `DOWNLOAD_PROVIDER_BASE_URL` for IG/TikTok/FB/Pinterest/X. Direct/Reddit/web work without it. |
| A link fails as "not publicly accessible" | The post is private/removed; nothing is fetched. |
| "Too many requests" | Raise `RATE_LIMIT_*`, or wait for the window. |
| ZIP not building for huge batches | Configure `OBJECT_STORE_*` so `/api/zip/store` can be used, or split the batch. |
| `/api/health` shows `signedTokens: ephemeral` | Set `TOKEN_SECRET` for stable signed links across instances. |

## Adding another provider

1. Create `src/lib/providers/my-platform.ts` implementing `MediaProvider` (or `createRemoteApiProvider` for the
   resolver adapter).
2. Register it in `src/lib/providers/registry.ts` (specific providers before the fallbacks).
3. Optionally add a landing page entry in `src/lib/seo/landing-pages.ts` and run
   `node scripts/generate-landing-pages.mjs`.
4. Add tests. Done — the API, queue, ZIP pipeline and UI pick it up automatically.

## License

MIT — see the spirit of it: use responsibly, only for content you have the right to download.
