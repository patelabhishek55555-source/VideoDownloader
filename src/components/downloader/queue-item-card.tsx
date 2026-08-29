"use client";

import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Download,
  Film,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlatformIcon } from "@/components/brand/platform-icons";
import { formatBytes, formatDuration } from "@/lib/zip/filename";
import { hostLabel } from "@/lib/validation/urls";
import { cn } from "@/lib/utils";
import type { QueueItem } from "./use-downloader";
import { useDownloaderContext } from "./downloader-context";
import type { QueueStatus } from "@/lib/types";

const STATUS_COPY: Record<QueueStatus, { label: string; tone: string; spinner?: boolean }> = {
  waiting: { label: "Waiting", tone: "text-muted-foreground" },
  queued: { label: "Queued", tone: "text-muted-foreground" },
  processing: { label: "Analyzing link", tone: "text-primary", spinner: true },
  ready: { label: "Ready", tone: "text-success" },
  downloading: { label: "Downloading", tone: "text-primary", spinner: true },
  completed: { label: "Completed", tone: "text-success" },
  failed: { label: "Failed", tone: "text-destructive" },
  unsupported: { label: "Unsupported", tone: "text-warning" },
};

function StatusIndicator({ status }: { status: QueueStatus }) {
  const copy = STATUS_COPY[status];

  if (status === "processing" || status === "downloading") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", copy.tone)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {copy.label}
      </span>
    );
  }
  if (status === "ready" || status === "completed") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", copy.tone)}>
        <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {copy.label}
      </span>
    );
  }
  if (status === "failed" || status === "unsupported") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", copy.tone)}>
        <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        {copy.label}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", copy.tone)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" aria-hidden="true" />
      {copy.label}
    </span>
  );
}

function Thumbnail({ item }: { item: QueueItem }) {
  const [failed, setFailed] = React.useState(false);
  const src = item.media?.thumbnail;

  if (!src || failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
        <Film className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    // Media thumbnails come from arbitrary public CDNs resolved at runtime, so a
    // plain lazy <img> is used rather than next/image with a fixed domain list.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.media?.title ? `Thumbnail for ${item.media.title}` : "Media thumbnail"}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-video w-full bg-muted object-cover"
    />
  );
}

export function QueueItemCard({ item, index }: { item: QueueItem; index: number }) {
  const { downloader } = useDownloaderContext();
  const format = downloader.formatFor(item);
  const media = item.media;
  const isWorking = item.status === "processing" || item.status === "downloading";
  const canDownload = item.status === "ready" || item.status === "completed";

  const progressPercent =
    item.progress?.total && item.progress.total > 0
      ? Math.min(100, (item.progress.received / item.progress.total) * 100)
      : undefined;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card transition-all duration-200 animate-fade-up",
        item.status === "failed" || item.status === "unsupported"
          ? "border-destructive/35"
          : "border-border/80 hover:border-border",
        canDownload && "hover:shadow-card",
      )}
      aria-label={`Queue item ${index + 1}`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full shrink-0 sm:w-44 md:w-52">
          <div className="overflow-hidden rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none">
            {item.status === "processing" || item.status === "waiting" || item.status === "queued" ? (
              <div className="aspect-video w-full shimmer-surface" />
            ) : (
              <Thumbnail item={item} />
            )}
          </div>
          {media?.duration ? (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatDuration(media.duration)}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted" className="gap-1.5">
                  <PlatformIcon id={media?.platform ?? "web"} size={13} />
                  {media?.providerName ?? hostLabel(item.url)}
                </Badge>
                <StatusIndicator status={item.status} />
              </div>

              {media?.title ? (
                <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-foreground" title={media.title}>
                  {media.title}
                </h3>
              ) : item.status === "processing" ? (
                <div className="mt-2 space-y-1.5">
                  <div className="shimmer-surface h-3.5 w-3/4 rounded" />
                  <div className="shimmer-surface h-3.5 w-1/2 rounded" />
                </div>
              ) : (
                <p className="mt-2 truncate text-sm text-muted-foreground" title={item.url}>
                  {item.url}
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => downloader.removeItem(item.id)}
              aria-label={`Remove link ${index + 1}`}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {item.error ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-[13px] leading-snug text-destructive">
              {item.error.message}
            </p>
          ) : null}

          {media && media.formats.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`quality-${item.id}`}>
                Quality for link {index + 1}
              </label>
              <Select
                value={format?.id}
                onValueChange={(value) => downloader.selectFormat(item.id, value)}
                disabled={isWorking || media.formats.length < 2}
              >
                <SelectTrigger id={`quality-${item.id}`} className="h-9 w-auto min-w-[9.5rem] max-w-full text-[13px]">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  {media.formats.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                      {option.fileSize ? ` · ${formatBytes(option.fileSize)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground">
                {format?.fileSize ? formatBytes(format.fileSize) : "Size unknown"}
                {media.formats.length > 1 ? ` · ${media.formats.length} options` : ""}
              </span>
            </div>
          ) : item.status === "processing" ? (
            <div className="shimmer-surface h-9 w-40 rounded-xl" />
          ) : null}

          {item.status === "downloading" ? (
            <div className="space-y-1.5">
              <Progress
                value={progressPercent ?? 0}
                indeterminate={progressPercent === undefined}
                aria-label="Download progress"
              />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {progressPercent !== undefined
                  ? `${Math.round(progressPercent)}% · ${formatBytes(item.progress?.received)} of ${formatBytes(item.progress?.total)}`
                  : "Preparing download…"}
              </p>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {canDownload ? (
              <Button
                type="button"
                size="sm"
                onClick={() => downloader.downloadItem(item.id)}
                className="min-w-[7.5rem]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {item.status === "completed" ? "Download again" : "Download"}
              </Button>
            ) : null}

            {item.status === "failed" || item.status === "unsupported" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => downloader.retryItem(item.id)}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            ) : null}

            {item.status === "completed" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-success">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Saved
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
