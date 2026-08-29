import type { Metadata, Viewport } from "next";

import { getConfig } from "@/lib/config/env";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/content";

import "./globals.css";
import { AnalyticsScript } from "@/components/site/analytics";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ThemeProvider } from "@/components/site/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

const DEFAULT_TITLE = "Video Downloader – Download Videos Online Fast & Free";

export async function generateMetadata(): Promise<Metadata> {
  const config = getConfig();
  return {
    ...buildMetadata({
      title: DEFAULT_TITLE,
      description: config.site.description,
      path: "/",
    }),
    metadataBase: new URL(config.site.url),
    title: { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` },
    keywords: [
      "video downloader",
      "download video",
      "online video downloader",
      "bulk video downloader",
      "video downloader online",
      "video download tool",
    ],
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground">
        <ThemeProvider>
          <ToastProvider>
            <a
              href="#queue"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
            >
              Skip to the download queue
            </a>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
            <AnalyticsScript />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
