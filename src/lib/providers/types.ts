/**
 * Provider contract.
 *
 * Every platform is isolated behind this interface, so adding a new one means
 * adding a file under `lib/providers/` and registering it — nothing else in the
 * app knows which platform a URL came from.
 */

import type { ResolvedMedia } from "@/lib/types";

export interface ResolveContext {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface MediaProvider {
  /** Stable machine id, e.g. `instagram`. */
  readonly id: string;
  /** Display name, e.g. `Instagram`. */
  readonly name: string;
  /** Platform slug used for landing pages and badges. */
  readonly platform: string;
  /** Hostnames this provider claims. Matched as exact or dot-suffixed. */
  readonly hosts: readonly string[];
  /** One line used in the platform grid. */
  readonly tagline: string;
  /**
   * True when the provider can only work with an external resolver service
   * configured through environment variables. The UI reports this honestly
   * instead of pretending the download will work.
   */
  readonly requiresConfiguration: boolean;
  /** Last resort providers run after every specific provider. */
  readonly isFallback?: boolean;

  match(url: URL): boolean;
  resolve(url: string, context?: ResolveContext): Promise<ResolvedMedia>;
}

export function hostMatches(hostname: string, hosts: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return hosts.some((candidate) => {
    const bare = candidate.toLowerCase().replace(/^www\./, "").replace(/^\*\./, "");
    return host === bare || host.endsWith(`.${bare}`);
  });
}
