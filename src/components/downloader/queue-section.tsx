"use client";

import * as React from "react";
import { ServerCog } from "lucide-react";

import { EmptyState } from "./empty-state";
import { QueueItemCard } from "./queue-item-card";
import { QueueToolbar } from "./queue-toolbar";
import { ResultsSummary } from "./results-summary";
import { ZipPanel } from "./zip-panel";
import { useDownloaderContext } from "./downloader-context";

function ServiceNotice() {
  const { status } = useDownloaderContext();
  if (status.downloaderService === "configured") return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3">
      <ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="text-[13px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Downloader service is not configured</p>
        <p className="mt-0.5">
          Direct media links, Reddit posts and web pages that publish a video file work right away. Instagram,
          TikTok, Facebook, Pinterest and X need a resolver service — set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
            DOWNLOAD_PROVIDER_BASE_URL
          </code>{" "}
          to enable them.
        </p>
      </div>
    </div>
  );
}

export function QueueSection() {
  const { downloader } = useDownloaderContext();
  const { items, phase } = downloader;

  return (
    <section id="queue" className="container-page scroll-mt-24 py-4">
      <div className="space-y-4">
        <ServiceNotice />

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <QueueToolbar />
            <ZipPanel />
            <ResultsSummary />

            <div className="grid gap-3 lg:grid-cols-2" aria-busy={phase !== "idle"}>
              {items.map((item, index) => (
                <QueueItemCard key={item.id} item={item} index={index} />
              ))}
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {phase === "processing"
                ? "Processing links"
                : `${downloader.stats.ready} ready, ${downloader.stats.failed} failed, ${downloader.stats.completed} completed`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
