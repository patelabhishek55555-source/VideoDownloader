import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Brand mark: a play triangle rotated to point down, sitting on a download tray.
 * It reads as both "play" and "download" at any size, from the favicon up.
 */
export function LogoMark({
  className,
  rounded = "rounded-[0.68em]",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.8)]",
        rounded,
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
        <path d="M7.6 6.2h8.8L12 13.1 7.6 6.2Z" fill="currentColor" />
        <path
          d="M5.9 16.9h12.2"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  wordmarkClassName,
  showWordmark = true,
}: {
  className?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8 text-[1rem]" />
      {showWordmark ? (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight text-foreground sm:text-base",
            wordmarkClassName,
          )}
        >
          Video Downloader
        </span>
      ) : null}
    </span>
  );
}
