import { type NextRequest } from "next/server";

import { errorResponse, guard, json } from "@/lib/api/http";
import { getConfig } from "@/lib/config/env";
import { resolveMediaUrl } from "@/lib/downloaders/resolve";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface ResolveBody {
  url?: unknown;
}

/**
 * Resolve a single URL into downloadable media.
 *
 * POST { url } → { ok: true, media } | { ok: false, error: { code, message } }
 *
 * This is the endpoint the browser uses per queue item, and the fallback path
 * when a server-side job is unavailable. It never returns file bytes — only
 * metadata plus signed direct media URLs.
 */
export async function POST(request: NextRequest) {
  try {
    await guard({ scope: "resolve", request });

    let body: ResolveBody;
    try {
      body = (await request.json()) as ResolveBody;
    } catch {
      throw new AppError("invalid_url", { message: "That doesn't look like a valid video link." });
    }

    const url = typeof body?.url === "string" ? body.url : "";
    if (!url) throw new AppError("invalid_url", { message: "Paste a link to get started." });

    const media = await resolveMediaUrl(url, {
      timeoutMs: Math.min(getConfig().limits.fetchTimeoutMs, 25000),
    });

    return json({ ok: true, media });
  } catch (error) {
    return errorResponse("api/resolve", error);
  }
}
