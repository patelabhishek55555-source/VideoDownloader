"use client";

import * as React from "react";
import { CheckCircle2, Download, FileArchive, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDownloaderContext } from "./downloader-context";

/**
 * Terminal state of a batch: full success, or a partial result with the actions
 * that make sense for it.
 */
export function ResultsSummary() {
  const { downloader } = useDownloaderContext();
  const { stats, phase } = downloader;

  const finished = stats.pending === 0 && stats.downloading === 0 && phase === "idle";
  const hasResults = stats.completed > 0 || stats.failed > 0;
  if (!finished || !hasResults || stats.total === 0) return null;

  const allGood = stats.failed === 0 && stats.completed > 0;

  return (
    <section
      aria-label="Batch result"
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
            (allGood ? "bg-success/15 text-success" : "bg-warning/15 text-warning")
          }
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {allGood
              ? "All downloads completed"
              : `${stats.completed} download${stats.completed === 1 ? "" : "s"} completed`}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {stats.completed} successful · {stats.failed} couldn&apos;t be processed
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {stats.failed > 0 ? (
          <>
            <Button type="button" size="sm" onClick={downloader.downloadAll}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download successful files
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={downloader.retryFailed}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retry failed
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={downloader.downloadAll}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download again
          </Button>
        )}
        <Button type="button" size="sm" onClick={downloader.buildZip}>
          <FileArchive className="h-4 w-4" aria-hidden="true" />
          Download ZIP
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={downloader.clearAll}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear queue
        </Button>
      </div>
    </section>
  );
}
