"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Default to the dark appearance until the stored preference is known, which
  // keeps the server-rendered markup identical to the first client paint.
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 " +
          "bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Sun
          className={cn("absolute h-4 w-4 transition-opacity", isDark ? "opacity-0" : "opacity-100")}
          aria-hidden="true"
        />
        <Moon
          className={cn("absolute h-4 w-4 transition-opacity", isDark ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
