import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PlatformIcon } from "@/components/brand/platform-icons";
import { Badge } from "@/components/ui/badge";
import { LandingShell } from "@/components/landing/landing-shell";
import { PLATFORMS } from "@/lib/providers/registry";
import { PLATFORM_LINKS } from "@/lib/seo/content";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Supported Platforms – Where the Video Downloader Works",
  description:
    "See which platforms the video downloader supports today, which work with no setup, and which need the optional resolver service configured.",
  path: "/supported-platforms",
});

export default function SupportedPlatformsPage() {
  return (
    <LandingShell
      eyebrow="Platforms"
      title="Supported platforms"
      lede="Support depends on what a source publishes. Everything marked Ready works on a default deployment; the rest are handled by the configurable resolver service."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:border-border"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-muted text-foreground">
                <PlatformIcon id={platform.id} size={18} />
              </span>
              <Badge variant={platform.status === "ready" ? "success" : "warning"}>
                {platform.status === "ready" ? "Ready" : "Setup required"}
              </Badge>
            </div>
            <h2 className="mt-4 text-[15px] font-semibold text-foreground">{platform.name}</h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{platform.tagline}</p>
            {platform.hosts.length > 0 ? (
              <p className="mt-3 truncate font-mono text-xs text-muted-foreground/80">{platform.hosts[0]}</p>
            ) : null}
            {platform.landingPath ? (
              <Link
                href={platform.landingPath}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-foreground"
              >
                Open the downloader
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">A note on honesty</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A platform is only listed here when there is a real provider behind it. Where a provider needs an
          external resolver service that has not been configured, the interface says so instead of showing a
          download button that cannot work. Nothing on this site bypasses logins, private accounts, age gates or
          digital rights management.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold text-foreground">Platform downloaders</h2>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {PLATFORM_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {link.label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Supported platforms", path: "/supported-platforms" },
            ]),
          ),
        }}
      />
    </LandingShell>
  );
}
