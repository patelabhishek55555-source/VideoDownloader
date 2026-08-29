import Link from "next/link";

import { COPYRIGHT_NOTICE } from "@/lib/seo/content";

/**
 * Natural-language SEO section.
 *
 * Deliberately secondary to the tool: a short, useful explainer with internal
 * links rather than a keyword-stuffed article.
 */
export function SeoCopy() {
  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-3xl space-y-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            An online video downloader built for batches
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Most download tools are built around a single link: paste it, wait, save. That works until you have a
            list. This one treats the list as the normal case — paste as many URLs as you like, watch them resolve
            in a queue, and take the results back however suits you: one file at a time, a controlled sequential
            run, or a single ZIP archive.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">How bulk downloading works</h3>
          <p className="leading-relaxed text-muted-foreground">
            Links are split, de-duplicated and validated before anything is fetched. Tracking parameters are
            ignored when comparing, so the same video shared twice with different query strings only appears once.
            Processing runs with a small number of simultaneous requests rather than firing everything at once,
            which keeps the browser responsive and is considerably politer to the sites involved. Each link is
            resolved independently, so one broken URL never blocks the rest of the batch.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            When you archive the batch, files are packaged with safe filenames: titles are slugified, illegal
            characters are removed, and duplicates get a numeric suffix so nothing is overwritten.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">About quality and formats</h3>
          <p className="leading-relaxed text-muted-foreground">
            The quality menu only ever lists renditions the source actually publishes. Where a page offers a
            single file, you see a single option; where it offers several, each entry shows its resolution,
            container and file size when that information is reported. Nothing is upscaled, re-encoded or invented.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            Support varies by source. Direct media links, public Reddit posts and web pages that publish a video
            file work with no configuration. Instagram, TikTok, Facebook, Pinterest and X are handled by a
            configurable resolver service, and the interface states plainly when that service has not been set up
            rather than showing a button that cannot work.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">Privacy by design</h3>
          <p className="leading-relaxed text-muted-foreground">
            Your links are not stored in a database and downloaded files are not kept. Temporary job records expire
            on their own, and no account, email address or social media password is ever requested. See the{" "}
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              privacy policy
            </Link>{" "}
            for the specifics.
          </p>
        </div>

        <div className="space-y-3 border-t border-border/70 pt-8">
          <h3 className="text-sm font-semibold text-foreground">Downloaders by platform</h3>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              { label: "Instagram video downloader", href: "/instagram-video-downloader" },
              { label: "Instagram Reels downloader", href: "/instagram-reels-downloader" },
              { label: "TikTok video downloader", href: "/tiktok-video-downloader" },
              { label: "Facebook video downloader", href: "/facebook-video-downloader" },
              { label: "Pinterest video downloader", href: "/pinterest-video-downloader" },
              { label: "Reddit video downloader", href: "/reddit-video-downloader" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function CopyrightNotice() {
  return (
    <section className="container-page pb-20">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">{COPYRIGHT_NOTICE.title}</h2>
        <div className="mt-3 space-y-3">
          {COPYRIGHT_NOTICE.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Read the full{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            terms of service
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
