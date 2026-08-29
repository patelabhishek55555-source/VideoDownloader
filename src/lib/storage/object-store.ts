/**
 * Temporary object storage for bulk ZIP jobs.
 *
 * Streaming a ZIP straight out of a function (see /api/zip) is the default and
 * needs no storage at all. For very large jobs — where the function may be
 * recycled before the archive finishes — /api/zip/store builds the archive into
 * an S3-compatible bucket and hands back a short-lived signed URL instead.
 *
 * Objects are written under a timestamped prefix and signed URLs expire after
 * OBJECT_STORE_TTL_SECONDS, so nothing is retained long term.
 */

import { AppError } from "@/lib/errors";
import { getConfig } from "@/lib/config/env";
import { presignUrl, sha256Hex, signRequest, UNSIGNED_PAYLOAD } from "./sigv4";

export interface PutObjectParams {
  key: string;
  contentType: string;
  /** Required: S3 will not accept a streamed PUT of unknown length here. */
  contentLength: number;
  body: ReadableStream<Uint8Array>;
}

export interface ObjectStore {
  readonly kind: "s3" | "none";
  put(params: PutObjectParams): Promise<{ key: string; url: string; expiresAt: number }>;
  signedUrl(key: string, ttlSeconds?: number): string;
  objectKey(name: string): string;
}

export class S3ObjectStore implements ObjectStore {
  readonly kind = "s3" as const;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly prefix: string;
  private readonly ttlSeconds: number;

  constructor() {
    const { objectStore } = getConfig();
    this.endpoint = objectStore.endpoint;
    this.region = objectStore.region;
    this.bucket = objectStore.bucket;
    this.accessKey = objectStore.accessKey;
    this.secretKey = objectStore.secretKey;
    this.prefix = objectStore.prefix;
    this.ttlSeconds = objectStore.ttlSeconds;
  }

  private get host(): string {
    const parsed = new URL(this.endpoint);
    return `${this.bucket}.${parsed.host}`;
  }

  objectKey(name: string): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${this.prefix}${stamp}/${safe}`;
  }

  signedUrl(key: string, ttlSeconds?: number): string {
    return presignUrl({
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
      region: this.region,
      service: "s3",
      host: this.host,
      path: `/${key.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`,
      expiresInSeconds: ttlSeconds ?? this.ttlSeconds,
    });
  }

  async put(params: PutObjectParams): Promise<{ key: string; url: string; expiresAt: number }> {
    const host = this.host;
    const path = `/${params.key.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
    const now = new Date();

    const signed = signRequest({
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
      region: this.region,
      service: "s3",
      method: "PUT",
      path,
      payloadHash: UNSIGNED_PAYLOAD,
      headers: {
        host,
        "content-type": params.contentType,
        "content-length": String(params.contentLength),
      },
      date: now,
    });

    const response = await fetch(`https://${host}${path}`, {
      method: "PUT",
      headers: {
        ...signed.headers,
        Authorization: signed.authorization,
      },
      body: params.body,
      // Length is known and signed, so a duplicated length header must not be sent.
      duplex: "half",
    } as RequestInit);

    if (!response.ok) {
      throw new AppError("server_error", {
        message: "We couldn't store the archive. Please try the direct ZIP download instead.",
        detail: `object store responded ${response.status}`,
      });
    }

    const expiresAt = Date.now() + this.ttlSeconds * 1000;
    return { key: params.key, url: this.signedUrl(params.key), expiresAt };
  }
}

export class NullObjectStore implements ObjectStore {
  readonly kind = "none" as const;

  objectKey(name: string): string {
    return name;
  }

  signedUrl(): string {
    throw this.unavailable();
  }

  async put(): Promise<never> {
    throw this.unavailable();
  }

  private unavailable(): AppError {
    return new AppError("server_error", {
      message: "Temporary storage is not configured, so stored ZIP downloads are unavailable.",
      detail: "set OBJECT_STORE_ENDPOINT, OBJECT_STORE_BUCKET, OBJECT_STORE_ACCESS_KEY and OBJECT_STORE_SECRET_KEY",
      status: 501,
    });
  }
}

let store: ObjectStore | null = null;

export function getObjectStore(): ObjectStore {
  if (store) return store;
  store = getConfig().objectStore.configured ? new S3ObjectStore() : new NullObjectStore();
  return store;
}

/** Reset the memoised store. Test hook. */
export function resetObjectStore(): void {
  store = null;
}

export { sha256Hex };
