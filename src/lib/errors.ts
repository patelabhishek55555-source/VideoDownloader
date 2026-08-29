/**
 * Error model shared by the API and the UI.
 *
 * Every failure carries a stable machine `code` plus a message that is safe to
 * show a person. Internal detail (stack traces, upstream bodies, credentials)
 * never crosses the API boundary — see `serialiseError`.
 */

export type ErrorCode =
  | "invalid_url"
  | "unsupported"
  | "private_content"
  | "not_found"
  | "rate_limited"
  | "too_large"
  | "blocked"
  | "timeout"
  | "provider_not_configured"
  | "provider_error"
  | "server_error";

const FRIENDLY: Record<ErrorCode, string> = {
  invalid_url: "That doesn't look like a valid video link.",
  unsupported: "This platform or link type isn't currently supported.",
  private_content: "This link isn't publicly accessible.",
  not_found: "We couldn't find any media at that link.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  too_large: "That file is larger than the download limit.",
  blocked: "This link can't be fetched for safety reasons.",
  timeout: "The site took too long to respond. Please try again.",
  provider_not_configured: "Downloader service is not configured.",
  provider_error: "We couldn't process this link right now. Please try again.",
  server_error: "Something went wrong on our side. Please try again.",
};

const STATUS: Record<ErrorCode, number> = {
  invalid_url: 400,
  unsupported: 422,
  private_content: 403,
  not_found: 404,
  rate_limited: 429,
  too_large: 413,
  blocked: 403,
  timeout: 504,
  provider_not_configured: 503,
  provider_error: 502,
  server_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** User-facing text. Overrides the default copy for the code when provided. */
  readonly publicMessage: string;
  /** Detail logged server-side only. */
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    options: { message?: string; detail?: string; status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(options.message ?? FRIENDLY[code]);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? STATUS[code];
    this.publicMessage = options.message ?? FRIENDLY[code];
    this.detail = options.detail;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface PublicError {
  code: ErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export function friendlyMessage(code: ErrorCode): string {
  return FRIENDLY[code];
}

/** Strip an unknown throwable down to something safe to return to a browser. */
export function serialiseError(error: unknown): { error: PublicError; status: number } {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.publicMessage,
        retryAfterSeconds: error.retryAfterSeconds,
      },
      status: error.status,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return { error: { code: "timeout", message: FRIENDLY.timeout }, status: 504 };
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return { error: { code: "provider_error", message: FRIENDLY.provider_error }, status: 502 };
  }

  return { error: { code: "server_error", message: FRIENDLY.server_error }, status: 500 };
}

/** Server-side logging helper: keeps detail out of responses but in the logs. */
export function logError(scope: string, error: unknown): void {
  if (error instanceof AppError) {
    console.warn(`[${scope}] ${error.code}${error.detail ? ` — ${error.detail}` : ""}`);
    return;
  }
  console.error(`[${scope}]`, error instanceof Error ? error.message : error);
}
