import { CopyrightNotice, SeoCopy } from "@/components/home/seo-copy";
import { Faq } from "@/components/home/faq";
import { Features } from "@/components/home/features";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Platforms } from "@/components/home/platforms";
import { TrustStrip } from "@/components/home/trust-strip";
import { DownloaderProvider } from "@/components/downloader/downloader-context";
import { MobileActionBar } from "@/components/downloader/queue-toolbar";
import { QueueSection } from "@/components/downloader/queue-section";
import { getConfig } from "@/lib/config/env";
import { PLATFORMS } from "@/lib/providers/registry";
import { jsonLd, softwareApplicationSchema } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const config = getConfig();

  return (
    <DownloaderProvider
      status={config.status}
      limits={{ maxBulkUrls: config.limits.maxBulkUrls, concurrency: config.limits.concurrency }}
    >
      <Hero />
      <TrustStrip />
      <QueueSection />
      <Features />
      <Platforms platforms={PLATFORMS} />
      <HowItWorks />
      <SeoCopy />
      <Faq />
      <CopyrightNotice />
      <MobileActionBar />

      <script
        type="application/ld+json"
        // Built from static copy in lib/seo — no user input reaches this.
        dangerouslySetInnerHTML={{ __html: jsonLd(softwareApplicationSchema(config.site.description)) }}
      />
    </DownloaderProvider>
  );
}
