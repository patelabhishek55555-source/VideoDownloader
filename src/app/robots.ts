import type { MetadataRoute } from "next";

import { getConfig } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const { url } = getConfig().site;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
