import type { Metadata } from "next";

import { getConfig } from "@/lib/config/env";
import { SITE_NAME } from "./content";

/** Server-side SEO helpers. Not safe to import from client components. */

export function absoluteUrl(path = "/"): string {
  const { url } = getConfig().site;
  if (!path || path === "/") return `${url}/`;
  return `${url}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface BuildMetadataOptions {
  title: string;
  description: string;
  path?: string;
  /** Optional OG image override; defaults to the site-wide generated image. */
  ogImage?: string;
  noIndex?: boolean;
}

export function buildMetadata(options: BuildMetadataOptions): Metadata {
  const { title, description, path = "/", ogImage, noIndex = false } = options;
  const url = absoluteUrl(path);
  const image = ogImage ? absoluteUrl(ogImage) : absoluteUrl("/opengraph-image");

  return {
    title,
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  };
}

export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ "@context": "https://schema.org", ...data });
}

export function faqSchema(items: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function howToSchema(steps: Array<{ title: string; description: string }>, name: string): Record<string, unknown> {
  return {
    "@type": "HowTo",
    name,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.description,
    })),
  };
}

export function breadcrumbSchema(crumbs: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function softwareApplicationSchema(description: string): Record<string, unknown> {
  return {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    url: absoluteUrl("/"),
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Bulk video downloading",
      "ZIP export of multiple downloads",
      "Sequential download queue",
      "Quality selection where a source provides it",
    ],
  };
}
