import { Sparkles } from "lucide-react";

import { UrlInputCard } from "@/components/downloader/url-input-card";
import { HERO } from "@/lib/seo/content";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-20" aria-hidden="true" />
      <div className="grid-lines pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]" aria-hidden="true" />

      <div className="container-page pt-14 sm:pt-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Bulk links · Quality options · ZIP export
          </span>

          <h1 className="mt-6 text-display-sm text-foreground sm:text-display lg:text-display-lg">
            Download Videos.
            <br />
            <span className="text-gradient">Save Them Your Way.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {HERO.subtitle}
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-3xl">
          <UrlInputCard />
        </div>
      </div>
    </section>
  );
}
