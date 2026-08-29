#!/usr/bin/env node
/**
 * Generates one route file per landing page defined in src/lib/seo/landing-pages.ts.
 *
 * The copy lives in one place; this script only emits the thin route wrappers so
 * every page keeps its own URL and can be edited individually afterwards.
 *
 * Usage: node scripts/generate-landing-pages.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "../src/app");

// Kept in sync with LANDING_PAGES in src/lib/seo/landing-pages.ts
const SLUGS = [
  "video-downloader",
  "instagram-video-downloader",
  "instagram-reels-downloader",
  "tiktok-video-downloader",
  "facebook-video-downloader",
  "pinterest-video-downloader",
  "reddit-video-downloader",
];

function pageComponent(slug) {
  const name = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return `import type { Metadata } from "next";

import { LandingPageView } from "@/components/landing/landing-page-view";
import { landingPage } from "@/lib/seo/landing-pages";
import { buildMetadata } from "@/lib/seo/metadata";

const SLUG = "${slug}";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const page = landingPage(SLUG);
  if (!page) return buildMetadata({ title: "Not found", description: "", path: "/", noIndex: true });
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: \`/\${SLUG}\`,
  });
}

export default function ${name}Page() {
  return <LandingPageView slug={SLUG} />;
}
`;
}

for (const slug of SLUGS) {
  const dir = resolve(appDir, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "page.tsx"), pageComponent(slug), "utf8");
  console.log(`generated src/app/${slug}/page.tsx`);
}
