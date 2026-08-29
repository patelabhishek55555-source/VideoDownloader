"use client";

import * as React from "react";
import { Download, FileArchive, ListOrdered, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDownloaderContext } from "./downloader-context";

export function QueueToolbar() {
  const { downloader } = useDownloaderContext();
  const { stats, sequential, phase } = downloader;
  const hasItems = stats.total > 0;
  const hasReady = stats.ready > 0;
  const busy = phase === "processing" || phase === "submitting";

  const heading = hasReady
    ? `${stats.ready} video${stats.ready === 1 ? "" : "s"} ready`
    : busy
      ? "Processing links…"
      : hasItems
        ? `${stats.total} link${stats.total === 1 ? "" : "s"} in queue`
        : "Download queue";

  return (
    <div className="sticky top-16 z-30 -mx-1 rounded-2xl border border-border/70 bg-background/85 px-4 py-3.5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{heading}</h2>
          {stats.failed > 0 ? (
            <span className="text-[13px] text-destructive">
              {stats.failed} couldn&apos;t be processed
            </span>
          ) : null}
          {stats.completed > 0 ? (
            <span className="text-[13px] text-success">{stats.completed} saved</span>
          ) : null}
        </div>

        <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <Button type="button" size="sm" onClick={downloader.downloadAll} disabled={!hasReady}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download all
          </Button>
          <Button type="button" size="sm" onClick={downloader.buildZip} disabled={!hasReady}>
            <FileArchive className="h-4 w-4" aria-hidden="true" />
            Download as ZIP
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={downloader.sequentialDownload}
            disabled={!hasReady || sequential !== null}
          >
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
            Sequential
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={downloader.clearCompleted}
            disabled={stats.completed === 0}
          >
            Clear completed
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={downloader.clearAll}
            disabled={!hasItems}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear all
          </Button>
        </div>
      </div>

      {sequential ? (
        <div className="mt-3 space-y-1.5">
          <Progress value={(sequential.active / Math.max(1, sequential.total)) * 100} />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Downloading {sequential.active} of {sequential.total}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Compact action bar pinned to the bottom of the viewport on small screens. */
export function MobileActionBar() {
  const { downloader } = useDownloaderContext();
  const { stats, sequential, zip } = downloader;
  const visible = stats.ready > 0 && zip.phase !== "streaming" && zip.phase !== "preparing";

  if (!visible) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 p-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2">
        <Button type="button" size="md" className="flex-1" onClick={downloader.downloadAll}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {sequential ? `${sequential.active}/${sequential.total}` : "Download all"}
        </Button>
        <Button type="button" size="md" variant="outline" className="flex-1" onClick={downloader.buildZip}>
          <FileArchive className="h-4 w-4" aria-hidden="true" />
          ZIP
        </Button>
      </div>
    </div>
  );
}
