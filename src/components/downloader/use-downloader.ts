"use client";

import * as React from "react";

import {
  ApiError,
  continueJob,
  createJob,
  resolveUrl,
  streamZipArchive,
  storeZipArchive,
} from "@/lib/client/api";
import {
  buildFileNames,
  buildFileName,
  delay,
  downloadFile,
  runWithConcurrency,
  saveBlob,
} from "@/lib/client/download";
import { parseUrlList } from "@/lib/validation/urls";
import { defaultArchiveName } from "@/lib/zip/filename";
import { entryOffsets, type EntryOffset } from "@/lib/zip/size";
import type { MediaFormat, QueueStatus, ResolvedMedia } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

export interface QueueItem {
  id: string;
  url: string;
  status: QueueStatus;
  media?: ResolvedMedia;
  error?: { code: string; message: string };
  formatId?: string;
  progress?: { received: number; total?: number };
}

export interface DownloaderStats {
  total: number;
  ready: number;
  failed: number;
  completed: number;
  downloading: number;
  pending: number;
  totalBytes: number;
}

export type ZipPhase = "idle" | "preparing" | "streaming" | "ready" | "error";

export interface ZipState {
  phase: ZipPhase;
  received: number;
  total?: number;
  entryIndex?: number;
  entryName?: string;
  entries: number;
  error?: string;
  archiveName: string;
  /** Set once the archive has been received and can be saved again. */
  hasArchive: boolean;
}

export interface AddLinksResult {
  added: number;
  duplicates: number;
  invalid: { raw: string; message: string }[];
  truncated: boolean;
}

const IDLE_ZIP: Omit<ZipState, "archiveName"> = {
  phase: "idle",
  received: 0,
  entries: 0,
  hasArchive: false,
};

export interface UseDownloaderOptions {
  maxBulkUrls: number;
  concurrency: number;
  objectStoreConfigured: boolean;
}

export function useDownloader({ maxBulkUrls, concurrency, objectStoreConfigured }: UseDownloaderOptions) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [phase, setPhase] = React.useState<"idle" | "submitting" | "processing">("idle");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [sequential, setSequential] = React.useState<{ active: number; total: number } | null>(null);
  const [zip, setZip] = React.useState<ZipState>({ ...IDLE_ZIP, archiveName: defaultArchiveName() });

  const abortRef = React.useRef<AbortController | null>(null);
  const zipBlobRef = React.useRef<Blob | null>(null);
  const itemsRef = React.useRef<QueueItem[]>([]);
  itemsRef.current = items;

  const patchItem = React.useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  /* ── Adding links ──────────────────────────────────────────────────────── */

  const addLinks = React.useCallback(
    (text: string): AddLinksResult => {
      const parsed = parseUrlList(text, maxBulkUrls);
      if (parsed.valid.length === 0) {
        return { added: 0, duplicates: parsed.duplicates.length, invalid: parsed.invalid, truncated: false };
      }

      let added = 0;
      let extraDuplicates = 0;

      setItems((current) => {
        const known = new Set(current.map((item) => item.url));
        const next = [...current];
        for (const entry of parsed.valid) {
          if (known.has(entry.normalized)) {
            extraDuplicates += 1;
            continue;
          }
          known.add(entry.normalized);
          added += 1;
          next.push({ id: entry.id, url: entry.normalized, status: "waiting" });
        }
        return next;
      });

      return {
        added,
        duplicates: parsed.duplicates.length + extraDuplicates,
        invalid: parsed.invalid,
        truncated: parsed.truncated,
      };
    },
    [maxBulkUrls],
  );

  const removeItem = React.useCallback(
    (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
      toast({ title: "Link removed", tone: "default", duration: 2200 });
    },
    [toast],
  );

  const clearAll = React.useCallback(() => {
    abortRef.current?.abort();
    zipBlobRef.current = null;
    setItems([]);
    setPhase("idle");
    setJobId(null);
    setSequential(null);
    setZip((current) => ({ ...IDLE_ZIP, archiveName: current.archiveName }));
  }, []);

  const clearCompleted = React.useCallback(() => {
    setItems((current) => current.filter((item) => item.status !== "completed"));
  }, []);

  const selectFormat = React.useCallback(
    (id: string, formatId: string) => patchItem(id, { formatId }),
    [patchItem],
  );

  /* ── Processing ────────────────────────────────────────────────────────── */

  const mergeJobItems = React.useCallback((jobItems: Array<{ url: string; status: QueueStatus; media?: ResolvedMedia; error?: { code: string; message: string } }>) => {
    const byUrl = new Map(jobItems.map((entry) => [entry.url, entry]));
    setItems((current) =>
      current.map((item) => {
        const match = byUrl.get(item.url);
        if (!match) return item;
        return {
          ...item,
          status: match.status,
          media: match.media ?? item.media,
          error: match.error,
          formatId: match.media ? match.media.formats[0]?.id ?? item.formatId : item.formatId,
        };
      }),
    );
  }, []);

  /** Fallback path: resolve whatever the job system could not, in the browser. */
  const resolveLocally = React.useCallback(
    async (targets: QueueItem[]) => {
      await runWithConcurrency(targets, concurrency, async (item) => {
        if (abortRef.current?.signal.aborted) return;
        patchItem(item.id, { status: "processing", error: undefined });
        try {
          const { media } = await resolveUrl(item.url, abortRef.current?.signal);
          patchItem(item.id, { status: "ready", media, formatId: media.formats[0]?.id, error: undefined });
        } catch (error) {
          const message =
            error instanceof ApiError ? error.message : "We couldn't process this link right now. Please try again.";
          const code = error instanceof ApiError ? error.code : "server_error";
          patchItem(item.id, {
            status: code === "unsupported" ? "unsupported" : "failed",
            error: { code, message },
          });
        }
      });
    },
    [concurrency, patchItem],
  );

  const processQueue = React.useCallback(
    async (targets?: QueueItem[]) => {
      const pending = (targets ?? itemsRef.current).filter(
        (item) => item.status === "waiting" || item.status === "queued" || item.status === "failed" || item.status === "unsupported",
      );
      if (pending.length === 0 || phase === "processing") return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPhase("submitting");
      setZip((current) => ({ ...IDLE_ZIP, archiveName: current.archiveName }));

      const urls = pending.map((item) => item.url);
      let remaining = urls;

      try {
        const created = await createJob(urls.join("\n"));
        setJobId(created.jobId);
        mergeJobItems(created.job.items);
        setPhase("processing");

        remaining = created.job.items
          .filter((item) => item.status === "queued" || item.status === "processing")
          .map((item) => item.url);

        // Keep advancing the server job until nothing is queued. Each call is
        // bounded by the server's concurrency and time budget.
        let guard = 0;
        while (remaining.length > 0 && guard < 40 && !controller.signal.aborted) {
          guard += 1;
          try {
            const next = await continueJob(created.jobId);
            mergeJobItems(next.job.items);
            remaining = next.job.items
              .filter((item) => item.status === "queued" || item.status === "processing")
              .map((item) => item.url);
            if (remaining.length === 0) break;
          } catch (error) {
            if (error instanceof ApiError && (error.code === "not_found" || error.code === "job_not_found")) {
              // Job store is per-instance; finish the batch in the browser.
              break;
            }
            throw error;
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.code !== "rate_limited") {
          // The job system is unavailable; fall through to direct resolution.
        } else if (error instanceof ApiError) {
          toast({ title: error.message, tone: "warning" });
          setPhase("idle");
          return;
        }
      }

      const leftovers = itemsRef.current.filter(
        (item) => remaining.includes(item.url) && (item.status === "waiting" || item.status === "queued" || item.status === "processing"),
      );
      if (leftovers.length > 0 && !controller.signal.aborted) {
        await resolveLocally(leftovers);
      }

      setPhase("idle");
    },
    [mergeJobItems, phase, resolveLocally, toast],
  );

  const retryItem = React.useCallback(
    (id: string) => {
      const target = itemsRef.current.find((item) => item.id === id);
      if (!target) return;
      patchItem(id, { status: "waiting", error: undefined });
      void processQueue([{ ...target, status: "waiting" }]);
    },
    [patchItem, processQueue],
  );

  const retryFailed = React.useCallback(() => {
    const failed = itemsRef.current.filter((item) => item.status === "failed" || item.status === "unsupported");
    if (failed.length === 0) return;
    setItems((current) =>
      current.map((item) =>
        item.status === "failed" || item.status === "unsupported"
          ? { ...item, status: "waiting", error: undefined }
          : item,
      ),
    );
    void processQueue(failed.map((item) => ({ ...item, status: "waiting" })));
  }, [processQueue]);

  /* ── Downloads ─────────────────────────────────────────────────────────── */

  const formatFor = React.useCallback((item: QueueItem): MediaFormat | undefined => {
    if (!item.media || item.media.formats.length === 0) return undefined;
    return item.media.formats.find((format) => format.id === item.formatId) ?? item.media.formats[0];
  }, []);

  const downloadItem = React.useCallback(
    async (id: string, options: { silent?: boolean } = {}): Promise<boolean> => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item?.media) return false;

      const format = formatFor(item);
      if (!format) {
        toast({ title: "No downloadable file was found for this link.", tone: "warning" });
        return false;
      }

      const index = itemsRef.current.findIndex((entry) => entry.id === id);
      const filename = buildFileName(item.media, format, item.url, index);

      patchItem(id, { status: "downloading", progress: { received: 0, total: format.fileSize } });

      try {
        const result = await downloadFile({
          url: format.url,
          token: format.token,
          filename,
          signal: abortRef.current?.signal,
          onProgress: (progress) => patchItem(id, { progress }),
        });
        patchItem(id, { status: "completed", progress: { received: result.bytes ?? format.fileSize ?? 0, total: format.fileSize } });
        if (!options.silent) toast({ title: "Download started", description: filename, tone: "success" });
        return true;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          patchItem(id, { status: "ready", progress: undefined });
          return false;
        }
        const message = error instanceof Error ? error.message : "The download failed. Please try again.";
        patchItem(id, { status: "ready", progress: undefined, error: { code: "download_failed", message } });
        toast({ title: "Download failed", description: message, tone: "destructive" });
        return false;
      }
    },
    [formatFor, patchItem, toast],
  );

  /** Controlled parallel downloads — never an unbounded burst. */
  const downloadAll = React.useCallback(async () => {
    const ready = itemsRef.current.filter((item) => item.status === "ready" || item.status === "failed");
    const targets = ready.filter((item) => item.status === "ready");
    if (targets.length === 0) {
      toast({ title: "Nothing ready to download yet", tone: "warning" });
      return;
    }
    await runWithConcurrency(targets, concurrency, async (item, index) => {
      await delay(index * 220);
      await downloadItem(item.id, { silent: true });
    });
    toast({ title: `${targets.length} download${targets.length === 1 ? "" : "s"} started`, tone: "success" });
  }, [concurrency, downloadItem, toast]);

  /** Strictly one file at a time, with "downloading N of M" feedback. */
  const sequentialDownload = React.useCallback(async () => {
    const targets = itemsRef.current.filter((item) => item.status === "ready");
    if (targets.length === 0) {
      toast({ title: "Nothing ready to download yet", tone: "warning" });
      return;
    }

    setSequential({ active: 0, total: targets.length });
    let done = 0;
    for (const item of targets) {
      if (abortRef.current?.signal.aborted) break;
      setSequential({ active: done + 1, total: targets.length });
      await downloadItem(item.id, { silent: true });
      done += 1;
      await delay(350);
    }
    setSequential(null);
    toast({ title: `${done} of ${targets.length} downloads finished`, tone: "success" });
  }, [downloadItem, toast]);

  /* ── ZIP ───────────────────────────────────────────────────────────────── */

  const readyZipItems = React.useCallback(() => {
    return itemsRef.current
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (item.status === "ready" || item.status === "completed") && Boolean(item.media));
  }, []);

  const setArchiveName = React.useCallback((name: string) => {
    setZip((current) => ({ ...current, archiveName: name }));
  }, []);

  const downloadStoredBlob = React.useCallback(() => {
    if (!zipBlobRef.current) return;
    saveBlob(zipBlobRef.current, zip.archiveName);
    toast({ title: "ZIP is ready", description: zip.archiveName, tone: "success" });
  }, [toast, zip.archiveName]);

  const buildZip = React.useCallback(async () => {
    const targets = readyZipItems();
    if (targets.length === 0) {
      toast({ title: "Nothing ready to archive yet", tone: "warning" });
      return;
    }

    const payloadItems = targets.map(({ item, index }) => {
      const format = formatFor(item)!;
      return { item, format, url: item.url, index };
    });

    const filenames = buildFileNames(payloadItems.map(({ item, format }) => ({ media: item.media, format, url: item.url })));
    const sized = payloadItems.map(({ format }, i) => ({ filename: filenames[i]!, fileSize: format.fileSize }));
    const plan = entryOffsets(sized);

    setZip({
      phase: "preparing",
      received: 0,
      total: plan?.total,
      entries: payloadItems.length,
      archiveName: zip.archiveName,
      hasArchive: false,
    });

    // Very large archives are built in object storage when it is configured, so
    // the browser never has to hold the whole thing in memory.
    const useStore = objectStoreConfigured && plan !== null && plan.total > 400 * 1024 * 1024;

    try {
      if (useStore) {
        const stored = await storeZipArchive({
          archiveName: zip.archiveName,
          items: payloadItems.map(({ format }, i) => ({
            url: format.url,
            token: format.token,
            filename: filenames[i]!,
            fileSize: format.fileSize,
          })),
        });
        setZip((current) => ({
          ...current,
          phase: "ready",
          received: stored.bytes,
          total: stored.bytes,
          archiveName: stored.filename,
          hasArchive: false,
        }));
        const anchor = document.createElement("a");
        anchor.href = stored.url;
        anchor.download = stored.filename;
        anchor.rel = "noopener";
        anchor.target = "_blank";
        anchor.click();
        toast({ title: "ZIP is ready", description: stored.filename, tone: "success" });
        return;
      }

      const { blob, bytes } = await streamZipArchive(
        {
          archiveName: zip.archiveName,
          items: payloadItems.map(({ format }, i) => ({
            url: format.url,
            token: format.token,
            filename: filenames[i]!,
            fileSize: format.fileSize,
          })),
        },
        {
          entryOffsets: plan?.offsets as EntryOffset[] | undefined,
          total: plan?.total,
          onProgress: (event) =>
            setZip((current) => ({
              ...current,
              phase: "streaming",
              received: event.received,
              total: event.total,
              entryIndex: event.entryIndex,
              entryName: event.entryName,
            })),
        },
      );

      zipBlobRef.current = blob;
      setZip((current) => ({ ...current, phase: "ready", received: bytes, hasArchive: true }));
      saveBlob(blob, zip.archiveName);
      toast({ title: "ZIP is ready", description: zip.archiveName, tone: "success" });
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "The archive couldn't be created. Please try again.";
      setZip((current) => ({ ...current, phase: "error", error: message }));
      toast({ title: "ZIP failed", description: message, tone: "destructive" });
    }
  }, [formatFor, objectStoreConfigured, readyZipItems, toast, zip.archiveName]);

  const resetZip = React.useCallback(() => {
    zipBlobRef.current = null;
    setZip((current) => ({ ...IDLE_ZIP, archiveName: current.archiveName }));
  }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  /* ── Derived state ─────────────────────────────────────────────────────── */

  const stats = React.useMemo<DownloaderStats>(() => {
    const counts: DownloaderStats = {
      total: items.length,
      ready: 0,
      failed: 0,
      completed: 0,
      downloading: 0,
      pending: 0,
      totalBytes: 0,
    };

    for (const item of items) {
      if (item.status === "ready") counts.ready += 1;
      else if (item.status === "completed") counts.completed += 1;
      else if (item.status === "downloading") counts.downloading += 1;
      else if (item.status === "failed" || item.status === "unsupported") counts.failed += 1;
      else counts.pending += 1;

      const format = formatFor(item);
      if (format?.fileSize) counts.totalBytes += format.fileSize;
    }

    return counts;
  }, [formatFor, items]);

  return {
    items,
    stats,
    phase,
    jobId,
    sequential,
    zip,
    addLinks,
    removeItem,
    clearAll,
    clearCompleted,
    selectFormat,
    processQueue: () => void processQueue(),
    retryItem,
    retryFailed,
    downloadItem: (id: string) => void downloadItem(id),
    downloadAll: () => void downloadAll(),
    sequentialDownload: () => void sequentialDownload(),
    buildZip: () => void buildZip(),
    setArchiveName,
    resetZip,
    downloadStoredBlob,
    formatFor,
  };
}

export type Downloader = ReturnType<typeof useDownloader>;
