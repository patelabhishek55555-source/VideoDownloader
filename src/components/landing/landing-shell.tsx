import * as React from "react";

import { CopyrightNotice } from "@/components/home/seo-copy";

/** Shared shell for the informational pages (platforms, privacy, terms, contact). */
export function LandingShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-20" aria-hidden="true" />
        <div className="container-page pt-14 sm:pt-20">
          <div className="mx-auto max-w-3xl">
            {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
            <h1 className="mt-3 text-display-sm text-foreground sm:text-display">{title}</h1>
            {lede ? (
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{lede}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="container-page py-16">
        <div className="mx-auto max-w-3xl space-y-6 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-primary [&_a]:underline-offset-4 hover:[_a]:underline">
          {children}
        </div>
      </div>

      <CopyrightNotice />
    </>
  );
}
