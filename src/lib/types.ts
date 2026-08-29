/**
 * Domain types shared by the server (providers, jobs, API) and the browser
 * (queue, cards, ZIP dialog). Everything here must be JSON-serialisable.
 */

export type MediaKind = "video" | "audio" | "image";

/** One selectable rendition of a resolved media item. */
export interface MediaFormat {
  id: string;
  /** Human label, e.g. "1080p MP4". */
  label: string;
  /** Short quality tag used for sorting, e.g. "1080p", "audio". */
  quality: string;
  ext: string;
  kind: MediaKind;
  /** Direct media URL. Never fetched by the browser without user intent. */
  url: string;
  /** HMAC token proving this URL came from our resolver. See lib/security/tokens. */
  token: string;
  fileSize?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
}

export interface ResolvedMedia {
  id: string;
  providerId: string;
  providerName: string;
  /** Platform slug used for the landing pages and platform badges. */
  platform: string;
  kind: MediaKind | "gallery";
  title?: string;
  thumbnail?: string;
  duration?: number;
  author?: string;
  /** The page URL this media was resolved from. */
  pageUrl: string;
  formats: MediaFormat[];
  /** Carousel / multi-image posts. */
  entries?: ResolvedMedia[];
  /** True when the resolver could not offer a quality choice. */
  singleFormat?: boolean;
}

export type QueueStatus =
  | "waiting"
  | "queued"
  | "processing"
  | "ready"
  | "downloading"
  | "completed"
  | "failed"
  | "unsupported";

export type JobStatus = "queued" | "processing" | "completed" | "partial" | "failed" | "expired";

export interface JobItemError {
  code: string;
  message: string;
}

export interface JobItem {
  id: string;
  url: string;
  status: QueueStatus;
  media?: ResolvedMedia;
  error?: JobItemError;
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  total: number;
  completed: number;
  failed: number;
  items: JobItem[];
}

export type PlatformStatus = "ready" | "requires-service";

export interface PlatformInfo {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  status: PlatformStatus;
  hosts: string[];
  landingPath: string | null;
}

/** Payload the browser sends when it wants a ZIP built. */
export interface ZipRequestItem {
  /** Direct media URL, previously issued by /api/resolve. */
  url: string;
  token: string;
  filename: string;
  fileSize?: number;
}

export interface ZipRequestBody {
  items: ZipRequestItem[];
  archiveName?: string;
}

export interface ServiceStatus {
  downloaderService: "configured" | "not-configured";
  jobStore: "redis" | "memory";
  objectStore: "configured" | "not-configured";
  signedTokens: "stable" | "ephemeral";
}
