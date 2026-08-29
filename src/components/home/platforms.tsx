import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/brand/platform-icons";
import type { PlatformEntry } from "@/lib/providers/registry";

export function Platforms({ platforms }: { platforms: PlatformEntry[] }) {
  return (
    <section id="platforms" className="container-page scroll-mt-24 py-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Supported platforms</p>
          <h2 className="mt-3 text-display-sm text-foreground">Where it works today</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Support depends on what a source publishes. Platforms marked{" "}
            <span className="font-medium text-foreground">Ready</span> need no setup; the rest are handled by the
            configurable resolver service and are reported honestly when it isn&apos;t set up.
          </p>
        </div>
        <Link
          href="/video-downloader"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-foreground"
        >
          About the downloader
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
          const ready = platform.status === "ready";
          const card = (
            <div className="group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-card">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-muted text-foreground transition-colors group-hover:bg-primary/12 group-hover:text-primary">
                  <PlatformIcon id={platform.id} size={18} />
                </span>
                <Badge variant={ready ? "success" : "warning"}>
                  {ready ? "Ready" : "Setup required"}
                </Badge>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-foreground">{platform.name}</h3>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{platform.tagline}</p>
              {platform.landingPath ? (
                <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Video downloader
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null}
            </div>
          );

          return platform.landingPath ? (
            <Link
              key={platform.id}
              href={platform.landingPath}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {card}
            </Link>
          ) : (
            <div key={platform.id}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
