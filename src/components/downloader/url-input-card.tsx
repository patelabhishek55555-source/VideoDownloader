"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Download,
  Layers,
  Link2,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDownloaderContext } from "./downloader-context";
import { parseUrlList } from "@/lib/validation/urls";
import { cn } from "@/lib/utils";
import { HERO } from "@/lib/seo/content";

type Mode = "single" | "bulk";

export function UrlInputCard() {
  const { downloader, limits } = useDownloaderContext();
  const { toast } = useToast();

  const [mode, setMode] = React.useState<Mode>("single");
  const [value, setValue] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const preview = React.useMemo(
    () => (value.trim().length === 0 ? null : parseUrlList(value, limits.maxBulkUrls)),
    [value, limits.maxBulkUrls],
  );

  const busy = downloader.phase !== "idle";
  const validCount = preview?.valid.length ?? 0;
  const duplicateCount = preview?.duplicates.length ?? 0;
  const invalidCount = preview?.invalid.length ?? 0;

  const submit = React.useCallback(() => {
    if (!preview || validCount === 0) {
      toast({
        title: preview?.invalid[0]?.message ?? "That doesn't look like a valid video link.",
        tone: "warning",
      });
      return;
    }

    const result = downloader.addLinks(value);
    setValue("");
    setMode("single");

    const parts = [`${result.added} link${result.added === 1 ? "" : "s"} added`];
    if (result.duplicates > 0) parts.push(`${result.duplicates} duplicate skipped`);
    if (result.invalid.length > 0) parts.push(`${result.invalid.length} invalid skipped`);
    if (result.truncated) parts.push(`capped at ${limits.maxBulkUrls}`);

    toast({ title: parts.join(" · "), tone: result.added > 0 ? "success" : "warning" });

    if (result.added > 0) {
      downloader.processQueue();
      const queue = document.getElementById("queue");
      queue?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [downloader, limits.maxBulkUrls, preview, toast, validCount, value]);

  const paste = React.useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast({ title: "Your clipboard is empty", tone: "default" });
        return;
      }
      const parsed = parseUrlList(text, limits.maxBulkUrls);
      if (parsed.valid.length > 1) setMode("bulk");
      setValue((current) => (current.trim() ? `${current.trim()}\n${text.trim()}` : text.trim()));
      toast({ title: "Pasted from clipboard", tone: "success", duration: 2000 });
    } catch {
      toast({
        title: "Clipboard access was blocked",
        description: "Use Ctrl/Cmd + V to paste into the field instead.",
        tone: "warning",
      });
      (mode === "bulk" ? textareaRef : inputRef).current?.focus();
    }
  }, [limits.maxBulkUrls, mode, toast]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (mode === "single" || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);

    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) {
      const readable = files.filter((file) => file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name));
      if (readable.length === 0) {
        toast({ title: "Drop a text file containing links", tone: "warning" });
        return;
      }
      const contents = await Promise.all(readable.map((file) => file.text()));
      const joined = contents.join("\n");
      setValue((current) => (current.trim() ? `${current.trim()}\n${joined}` : joined));
      setMode("bulk");
      toast({ title: `Read ${readable.length} file${readable.length === 1 ? "" : "s"}`, tone: "success" });
      return;
    }

    const text = event.dataTransfer.getData("text/plain") || event.dataTransfer.getData("text/uri-list");
    if (text.trim()) setValue((current) => (current.trim() ? `${current.trim()}\n${text.trim()}` : text.trim()));
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    if (next === "bulk") requestAnimationFrame(() => textareaRef.current?.focus());
    else requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-2xl border bg-card/80 p-2 shadow-elevated backdrop-blur-xl transition-all duration-200",
        dragging ? "border-primary ring-2 ring-primary/30" : "border-border/80",
      )}
    >
      {mode === "single" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Link2
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={HERO.placeholder}
              aria-label="Video URL"
              spellCheck={false}
              autoComplete="off"
              className="h-12 rounded-xl border-transparent bg-transparent pl-11 text-[15px] focus-visible:ring-0 sm:h-14"
            />
          </div>
          <div className="flex items-center gap-2 px-1 pb-1 sm:px-0 sm:pb-0">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => void paste()}
              className="h-11 flex-1 sm:h-11 sm:flex-none"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              Paste
            </Button>
            <Button
              type="button"
              size="md"
              onClick={submit}
              disabled={busy}
              className="h-11 flex-1 sm:h-11 sm:flex-none"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Download
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-1">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={HERO.bulkPlaceholder}
            aria-label="Multiple video URLs, one per line"
            spellCheck={false}
            rows={6}
            className="min-h-[9.5rem] rounded-xl border-transparent bg-transparent focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
            <Button type="button" size="md" onClick={submit} disabled={busy || validCount === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Layers className="h-4 w-4" aria-hidden="true" />}
              Add {validCount > 0 ? `${validCount} link${validCount === 1 ? "" : "s"}` : "links"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setValue("");
                textareaRef.current?.focus();
              }}
              disabled={value.length === 0}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => void paste()}>
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              Paste
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => switchMode("single")} className="ml-auto">
              Single link
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]" aria-live="polite">
          {preview ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  validCount > 0 ? "text-success" : "text-muted-foreground",
                )}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {validCount} valid link{validCount === 1 ? "" : "s"}
              </span>
              {duplicateCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {invalidCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {invalidCount} invalid link{invalidCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">{HERO.hint}</span>
          )}
        </div>

        {mode === "single" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => switchMode("bulk")}>
            <Layers className="h-4 w-4" aria-hidden="true" />
            Add multiple links
          </Button>
        ) : null}
      </div>

      {mode === "bulk" ? (
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          One link per line. Press ⌘/Ctrl + Enter to add. You can also drop a text file anywhere on this card.
        </p>
      ) : null}
    </div>
  );
}
