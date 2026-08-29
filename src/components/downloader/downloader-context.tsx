"use client";

import * as React from "react";

import { useDownloader, type Downloader } from "./use-downloader";
import type { ServiceStatus } from "@/lib/types";

export interface DownloaderLimits {
  maxBulkUrls: number;
  concurrency: number;
}

export interface DownloaderContextValue {
  downloader: Downloader;
  status: ServiceStatus;
  limits: DownloaderLimits;
}

const DownloaderContext = React.createContext<DownloaderContextValue | null>(null);

export function DownloaderProvider({
  children,
  status,
  limits,
}: {
  children: React.ReactNode;
  status: ServiceStatus;
  limits: DownloaderLimits;
}) {
  const downloader = useDownloader({
    maxBulkUrls: limits.maxBulkUrls,
    concurrency: limits.concurrency,
    objectStoreConfigured: status.objectStore === "configured",
  });

  const value = React.useMemo(() => ({ downloader, status, limits }), [downloader, status, limits]);

  return <DownloaderContext.Provider value={value}>{children}</DownloaderContext.Provider>;
}

export function useDownloaderContext(): DownloaderContextValue {
  const context = React.useContext(DownloaderContext);
  if (!context) throw new Error("useDownloaderContext must be used inside <DownloaderProvider>");
  return context;
}
