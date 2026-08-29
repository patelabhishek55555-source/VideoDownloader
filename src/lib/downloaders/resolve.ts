/**
 * The single entry point for turning a pasted URL into downloadable media.
 *
 * Used by `POST /api/resolve` and by the server-side bulk job processor, so both
 * paths get identical validation, error mapping and signed-URL behaviour.
 */

import { AppError } from "@/lib/errors";
import { findProvider } from "@/lib/providers/registry";
import { parseCandidateUrl } from "@/lib/validation/urls";
import { signUrl } from "@/lib/security/tokens";
import { assertAllowedHost } from "@/lib/security/ssrf";
import type { ResolvedMedia } from "@/lib/types";
import type { ResolveContext } from "@/lib/providers/types";

/** Stamp every format with a token proving it came from our resolver. */
export function attachTokens(media: ResolvedMedia): ResolvedMedia {
  const stamp = (item: ResolvedMedia): ResolvedMedia => ({
    ...item,
    formats: item.formats.map((format) => ({ ...format, token: signUrl(format.url).token })),
    entries: item.entries?.map(stamp),
  });
  return stamp(media);
}

/** Reject formats pointing at hosts that are not safe to fetch. */
function assertSafeFormats(media: ResolvedMedia): void {
  const check = (item: ResolvedMedia): void => {
    for (const format of item.formats) {
      assertAllowedHost(format.url);
    }
    item.entries?.forEach(check);
  };
  check(media);
}

export interface ResolveOptions extends ResolveContext {
  /** Skip the DNS/host validation of format URLs (used in unit tests). */
  skipFormatValidation?: boolean;
}

export async function resolveMediaUrl(rawUrl: string, options: ResolveOptions = {}): Promise<ResolvedMedia> {
  const parsed = parseCandidateUrl(rawUrl);
  if (!parsed.ok) {
    throw new AppError("invalid_url", { message: parsed.message });
  }

  const provider = findProvider(parsed.url);
  if (!provider) {
    throw new AppError("unsupported", {
      message: "This platform or link type isn't currently supported.",
    });
  }

  const media = await provider.resolve(parsed.normalized, options);

  if (!media.formats || media.formats.length === 0) {
    throw new AppError("not_found", { message: "We couldn't find any media at that link." });
  }

  if (!options.skipFormatValidation) assertSafeFormats(media);

  return { ...attachTokens(media), providerName: media.providerName || provider.name };
}
