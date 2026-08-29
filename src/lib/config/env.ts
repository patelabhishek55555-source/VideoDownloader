import { DEFAULT_ALLOWED_MEDIA_SUFFIXES } from "@/lib/security/ssrf";

/**
 * Central, typed access to every environment variable the app understands.
 *
 * Nothing here is required: every value has a safe default so the application
 * boots and serves the UI on a bare Vercel deploy. Values that unlock real
 * downloads are surfaced through `config.status` so the UI can be honest about
 * what is and isn't configured instead of faking a result.
 */

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface AppConfig {
  site: {
    url: string;
    name: string;
    description: string;
  };
  provider: {
    baseUrl: string;
    apiKey: string;
    headerName: string;
    method: "GET" | "POST";
    timeoutMs: number;
    configured: boolean;
  };
  token: {
    secret: string;
    /** True when TOKEN_SECRET is missing and an ephemeral per-instance key is used. */
    ephemeralSecret: boolean;
    ttlSeconds: number;
  };
  redis: {
    url: string;
    token: string;
    configured: boolean;
  };
  objectStore: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    prefix: string;
    ttlSeconds: number;
    configured: boolean;
  };
  limits: {
    maxBulkUrls: number;
    concurrency: number;
    jobProcessBudgetMs: number;
    jobTtlSeconds: number;
    maxFileSizeBytes: number;
    maxZipSizeBytes: number;
    maxZipEntries: number;
    maxPageBytes: number;
    fetchTimeoutMs: number;
  };
  rateLimit: {
    max: number;
    windowSeconds: number;
    maxPerDay: number;
  };
  security: {
    /**
     * Optional extra allowlist enforced by the download/ZIP proxy endpoints on
     * top of signed tokens. Empty means "any public host a resolver returned".
     */
    mediaHostAllowlist: string[];
  };
  analytics: {
    src: string;
  };
  /** Human readable capability summary, safe to expose to the browser. */
  status: {
    downloaderService: "configured" | "not-configured";
    jobStore: "redis" | "memory";
    objectStore: "configured" | "not-configured";
    signedTokens: "stable" | "ephemeral";
  };
}

/**
 * MEDIA_HOST_ALLOWLIST accepts a comma separated list of suffixes, or the
 * literal `default` to use the built-in list of known media CDN suffixes.
 */
function parseHostAllowlist(raw: string): string[] {
  if (!raw) return [];
  if (raw.trim().toLowerCase() === "default") return [...DEFAULT_ALLOWED_MEDIA_SUFFIXES];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/^\*\./, "").replace(/^https?:\/\//, ""))
    .filter(Boolean);
}

function resolveSiteUrl(): string {
  const explicit = str("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = str("VERCEL_PROJECT_PRODUCTION_URL") || str("VERCEL_URL");
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const port = str("PORT", "3000");
  return `http://localhost:${port}`;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const providerBaseUrl = str("DOWNLOAD_PROVIDER_BASE_URL");
  const redisUrl = str("UPSTASH_REDIS_REST_URL");
  const redisToken = str("UPSTASH_REDIS_REST_TOKEN");
  const objectEndpoint = str("OBJECT_STORE_ENDPOINT");
  const objectBucket = str("OBJECT_STORE_BUCKET");
  const objectAccessKey = str("OBJECT_STORE_ACCESS_KEY");
  const objectSecretKey = str("OBJECT_STORE_SECRET_KEY");
  const tokenSecret = str("TOKEN_SECRET");

  cached = {
    site: {
      url: resolveSiteUrl(),
      name: "Video Downloader",
      description:
        "Download videos online quickly and easily. Paste a video link or add multiple URLs to download videos individually, sequentially, or as a ZIP.",
    },
    provider: {
      baseUrl: providerBaseUrl.replace(/\/+$/, ""),
      apiKey: str("DOWNLOAD_PROVIDER_API_KEY"),
      headerName: str("DOWNLOAD_PROVIDER_HEADER_NAME", "Authorization"),
      method: str("DOWNLOAD_PROVIDER_METHOD", "POST").toUpperCase() === "GET" ? "GET" : "POST",
      timeoutMs: num("DOWNLOAD_PROVIDER_TIMEOUT_MS", 20000),
      configured: providerBaseUrl.length > 0,
    },
    token: {
      secret: tokenSecret,
      ephemeralSecret: tokenSecret.length === 0,
      ttlSeconds: num("TOKEN_TTL_SECONDS", 3600),
    },
    redis: {
      url: redisUrl,
      token: redisToken,
      configured: redisUrl.length > 0 && redisToken.length > 0,
    },
    objectStore: {
      endpoint: objectEndpoint.replace(/\/+$/, ""),
      region: str("OBJECT_STORE_REGION", "us-east-1"),
      bucket: objectBucket,
      accessKey: objectAccessKey,
      secretKey: objectSecretKey,
      prefix: str("OBJECT_STORE_PREFIX", "video-downloader/tmp/").replace(/^\/+/, ""),
      ttlSeconds: num("OBJECT_STORE_TTL_SECONDS", 900),
      configured:
        objectEndpoint.length > 0 &&
        objectBucket.length > 0 &&
        objectAccessKey.length > 0 &&
        objectSecretKey.length > 0,
    },
    limits: {
      maxBulkUrls: Math.min(200, Math.max(1, num("MAX_BULK_URLS", 25))),
      concurrency: Math.min(10, Math.max(1, num("PROCESS_CONCURRENCY", 3))),
      jobProcessBudgetMs: Math.min(300000, Math.max(2000, num("JOB_PROCESS_BUDGET_MS", 20000))),
      jobTtlSeconds: num("JOB_TTL_SECONDS", 1800),
      maxFileSizeBytes: num("MAX_FILE_SIZE_BYTES", 500 * 1024 * 1024),
      maxZipSizeBytes: num("MAX_ZIP_SIZE_BYTES", 2 * 1024 * 1024 * 1024),
      maxZipEntries: Math.min(500, Math.max(1, num("MAX_ZIP_ENTRIES", 100))),
      maxPageBytes: num("MAX_PAGE_BYTES", 2 * 1024 * 1024),
      fetchTimeoutMs: num("DEFAULT_FETCH_TIMEOUT_MS", 15000),
    },
    rateLimit: {
      max: num("RATE_LIMIT_MAX", 40),
      windowSeconds: num("RATE_LIMIT_WINDOW_SECONDS", 60),
      maxPerDay: num("RATE_LIMIT_MAX_PER_DAY", 400),
    },
    security: {
      mediaHostAllowlist: parseHostAllowlist(str("MEDIA_HOST_ALLOWLIST")),
    },
    analytics: {
      src: str("NEXT_PUBLIC_ANALYTICS_SRC"),
    },
    status: {
      downloaderService: providerBaseUrl.length > 0 ? "configured" : "not-configured",
      jobStore: redisUrl && redisToken ? "redis" : "memory",
      objectStore:
        objectEndpoint && objectBucket && objectAccessKey && objectSecretKey
          ? "configured"
          : "not-configured",
      signedTokens: tokenSecret ? "stable" : "ephemeral",
    },
  };

  return cached;
}

/** Reset the memoised config. Only used by tests. */
export function resetConfigCache(): void {
  cached = null;
}
