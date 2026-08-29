import Link from "next/link";
import { ArrowRight, ServerCog } from "lucide-react";

import { DownloaderProvider } from "@/components/downloader/downloader-context";
import { MobileActionBar } from "@/components/downloader/queue-toolbar";
import { QueueSection } from "@/components/downloader/queue-section";
import { UrlInputCard } from "@/components/downloader/url-input-card";
import { FaqAccordion } from "@/components/landing/page-faq";
import { PlatformIcon } from "@/components/brand/platform-icons";
import { getConfig } from "@/lib/config/env";
import { landingPage } from "@/lib/seo/landing-pages";
import {
  breadcrumbSchema,
  faqSchema,
  howToSchema,
  jsonLd,
} from "@/lib/seo/metadata";
import { PLATFORM_LINKS } from "@/lib/seo/content";
import { notFound } from "next/navigation";

export function LandingPageView({ slug }: { slug: string }) {
  const page = landingPage(slug);
  if (!page) notFound();

  const config = getConfig();

  return (
    <DownloaderProvider
      status={config.status}
      limits={{ maxBulkUrls: config.limits.maxBulkUrls, concurrency: config.limits.concurrency }}
    >
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-20" aria-hidden="true" />

        <div className="container-page pt-14 sm:pt-20">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-foreground">
                {page.h1}
              </li>
            </ol>
          </nav>

          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <PlatformIcon id={page.platformId} size={14} />
              {page.requiresService ? "Resolver service required" : "Works with no setup"}
            </span>

            <h1 className="mt-6 text-display-sm text-foreground sm:text-display">{page.h1}</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{page.lede}</p>
          </div>

          <div className="mx-auto mt-9 max-w-3xl">
            <UrlInputCard />
          </div>
        </div>
      </section>

      <QueueSection />

      <div className="container-page py-16">
        {page.requiresService && config.status.downloaderService !== "configured" ? (
          <div className="mb-12 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3">
            <ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">This platform needs the resolver service.</span>{" "}
              Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">DOWNLOAD_PROVIDER_BASE_URL</code>{" "}
              to enable it. Direct media links, Reddit posts and web pages that publish a video file already work.
            </p>
          </div>
        ) : null}

        <div className="mx-auto max-w-3xl space-y-12">
          {page.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">How to use it</h2>
            <ol className="mt-6 grid gap-3 md:grid-cols-3">
              {page.howTo.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-border/80 bg-card p-5">
                  <span className="text-sm font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 text-[15px] font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="rounded-2xl border border-border/80 bg-card px-6">
          <h2 className="pt-8 text-xl font-semibold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <div className="mt-2">
            <FaqAccordion items={page.faqs} />
          </div>
        </div>
      </div>

      <div className="container-page py-16">
        <h2 className="text-sm font-semibold text-foreground">More downloaders</h2>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {PLATFORM_LINKS.filter((link) => link.href !== `/${slug}`).map((link) => (
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
      </div>

      <MobileActionBar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(faqSchema(page.faqs)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(howToSchema(page.howTo, page.h1)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([{ name: "Home", path: "/" }, { name: page.h1, path: `/${slug}` }])),
        }}
      />
    </DownloaderProvider>
  );
}
