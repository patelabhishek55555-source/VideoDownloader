import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/seo/content";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Downloader",
    description:
      "Paste one link or many, pick a quality, and download videos individually, sequentially or as a ZIP.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    categories: ["utilities", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
