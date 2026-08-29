import { type NextRequest } from "next/server";

import { errorResponse, guard } from "@/lib/api/http";
import { getConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { cappedBodyStream, safeFetch } from "@/lib/security/http";
import { assertAllowedHost, assertPublicTarget } from "@/lib/security/ssrf";
import { verifyUrlToken } from "@/lib/security/tokens";
import { contentDisposition, contentTypeForExt, isMediaContentType } from "@/lib/validation/mime";
import { extFromUrl, sanitiseFilename } from "@/lib/zip/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stream a resolved media file to the browser.
 *
 * GET /api/download?url=…&token=…&name=…
 *
 * The signed token is the authorisation: only URLs this service handed out can be
 * proxied, so the endpoint cannot be repurposed as an open proxy. The body is
 * piped straight through — it is never buffered — and is capped by
 * MAX_FILE_SIZE_BYTES.
 */
export async function GET(request: NextRequest) {
  try {
    await guard({ scope: "download", request, max: Math.max(20, getConfig().rateLimit.max) });

    const url = request.nextUrl.searchParams.get("url");
    const token = request.nextUrl.searchParams.get("token");
    const requestedName = request.nextUrl.searchParams.get("name");

    if (!url) throw new AppError("invalid_url", { message: "No file was requested." });

    const verification = verifyUrlToken(url, token);
    if (!verification.ok) {
      throw new AppError("blocked", {
        message:
          verification.reason === "expired"
            ? "This download link has expired. Please process the link again."
            : "This link can't be fetched for safety reasons.",
      });
    }

    assertAllowedHost(url, { allowedSuffixes: getConfig().security.mediaHostAllowlist });
    await assertPublicTarget(url, { allowedSuffixes: getConfig().security.mediaHostAllowlist });

    const upstream = await safeFetch(url, { timeoutMs: 120_000 });
    if (!upstream.ok || !upstream.body) {
      throw new AppError("provider_error", {
        message: "We couldn't fetch that file. Please try again.",
        detail: `upstream ${upstream.status}`,
      });
    }

    const contentType = upstream.headers.get("content-type") ?? undefined;
    const ext = extFromUrl(url);
    const filename = sanitiseFilename(requestedName ?? undefined, { fallback: `video-${Date.now()}`, ext });

    const headers = new Headers({
      "content-type": isMediaContentType(contentType) ? contentType! : contentTypeForExt(ext),
      "content-disposition": contentDisposition(filename),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });

    const length = upstream.headers.get("content-length");
    if (length) headers.set("content-length", length);

    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("accept-ranges", acceptRanges);

    return new Response(cappedBodyStream(upstream.body, getConfig().limits.maxFileSizeBytes), { headers });
  } catch (error) {
    return errorResponse("api/download", error);
  }
}
