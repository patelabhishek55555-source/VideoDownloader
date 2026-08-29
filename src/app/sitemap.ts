import type { MetadataRoute } from "next";

import { getConfig } from "@/lib/config/env";
import { LANDING_PAGES } from "@/lib/seo/landing-pages";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const { url } = getConfig().site;
  const lastModified = new Date();

  const staticRoutes = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/contact", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${url}${route.path === "/" ? "/" : route.path}`,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...LANDING_PAGES.map((page) => ({
      url: `${url}/${page.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: page.slug === "video-downloader" ? 0.9 : 0.7,
    })),
  ];
}
