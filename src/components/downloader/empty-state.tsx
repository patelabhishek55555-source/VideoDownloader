"use client";

import * as React from "react";
import { ClipboardPaste, HardDriveDownload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EMPTY_STATE } from "@/lib/seo/content";

export function EmptyState() {
  const focusInput = () => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Video URL"]');
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-muted text-muted-foreground">
        <HardDriveDownload className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-base font-semibold text-foreground">{EMPTY_STATE.title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{EMPTY_STATE.description}</p>
      <Button type="button" variant="outline" size="sm" className="mt-5" onClick={focusInput}>
        <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
        {EMPTY_STATE.action}
      </Button>
    </div>
  );
}
