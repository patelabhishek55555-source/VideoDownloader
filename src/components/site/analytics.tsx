import { getConfig } from "@/lib/config/env";

/**
 * Optional, privacy-preserving analytics.
 *
 * Renders nothing unless NEXT_PUBLIC_ANALYTICS_SRC is set, so a default
 * deployment ships zero third-party scripts.
 */
export function AnalyticsScript() {
  const config = getConfig();
  const { src } = config.analytics;
  if (!src) return null;

  let domain: string | undefined;
  try {
    domain = new URL(config.site.url).hostname;
  } catch {
    domain = undefined;
  }

  return <script defer data-domain={domain} src={src} />;
}
