import type { Metadata } from "next";

import { LandingPageView } from "@/components/landing/landing-page-view";
import { landingPage } from "@/lib/seo/landing-pages";
import { buildMetadata } from "@/lib/seo/metadata";

const SLUG = "facebook-video-downloader";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const page = landingPage(SLUG);
  if (!page) return buildMetadata({ title: "Not found", description: "", path: "/", noIndex: true });
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/${SLUG}`,
  });
}

export default function FacebookVideoDownloaderPage() {
  return <LandingPageView slug={SLUG} />;
}
