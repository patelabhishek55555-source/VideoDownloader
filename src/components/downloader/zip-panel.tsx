"use client";

import * as React from "react";
import { CircleCheck, Download, FileArchive, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/zip/filename";
import { useDownloaderContext } from "./downloader-context";

/**
 * Dedicated ZIP interface.
 *
 * Progress is derived from the byte stream: because entries are stored rather
 * than compressed, the client knows each file's exact offset in the archive and
 * can name the file currently being written.
 */
export function ZipPanel() {
  const { downloader } = useDownloaderContext();
  const { zip, stats } = downloader;

  if (zip.phase === "idle") return null;

  const percent = zip.total ? Math.min(100, (zip.received / zip.total) * 100) : undefined;
  const currentIndex = zip.entryIndex !== undefined ? zip.entryIndex + 1 : undefined;

  return (
    <section
      aria-label="ZIP archive progress"
      className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <FileArchive className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {zip.phase === "ready"
                ? "ZIP ready"
                : zip.phase === "error"
                  ? "ZIP failed"
                  : "Preparing your ZIP"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {zip.entries} file{zip.entries === 1 ? "" : "s"} ·{" "}
              {zip.total ? formatBytes(zip.total) : "size unknown"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={downloader.resetZip}
          aria-label="Close ZIP panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-4 p-5">
        {zip.phase === "error" ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
              {zip.error}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={downloader.buildZip}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={downloader.downloadAll}>
                Download files individually
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Progress
                value={percent ?? 0}
                indeterminate={zip.phase === "preparing"}
                tone={zip.phase === "ready" ? "success" : "default"}
                aria-label="ZIP creation progress"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span aria-live="polite">
                  {zip.phase === "ready"
                    ? "Archive complete"
                    : currentIndex
                      ? `Adding ${currentIndex} of ${zip.entries}`
                      : `Adding 1 of ${zip.entries}`}
                  {percent !== undefined ? ` · ${Math.round(percent)}%` : ""}
                </span>
                <span>{formatBytes(zip.received)}</span>
              </div>
            </div>

            {zip.phase === "streaming" && zip.entryName ? (
              <p className="truncate text-[13px] text-muted-foreground">
                Current file: <span className="font-mono text-foreground">{zip.entryName}</span>
              </p>
            ) : null}

            {zip.phase === "preparing" ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Preparing ZIP…
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label htmlFor="archive-name" className="sr-only">
                  Archive filename
                </label>
                <Input
                  id="archive-name"
                  value={zip.archiveName}
                  onChange={(event) => downloader.setArchiveName(event.target.value)}
                  disabled={zip.phase === "streaming" || zip.phase === "preparing"}
                  className="h-10 font-mono text-[13px]"
                  placeholder="video-downloads.zip"
                />
              </div>

              {zip.phase === "ready" ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                    <CircleCheck className="h-4 w-4" aria-hidden="true" />
                    Ready
                  </span>
                  {zip.hasArchive ? (
                    <Button type="button" size="sm" onClick={downloader.downloadStoredBlob}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download ZIP
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {stats.ready === 0 && zip.phase !== "ready" ? (
              <p className="text-xs text-muted-foreground">
                Only files that processed successfully are included in the archive.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
