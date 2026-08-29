import * as React from "react";

import { cn, clamp } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  /** Render an indeterminate bar (used while a total is unknown). */
  indeterminate?: boolean;
  tone?: "default" | "success" | "warning" | "destructive";
}

const TONES = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
} as const;

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indeterminate = false, tone = "default", ...props }, ref) => {
    const percent = clamp(Number.isFinite(value) ? value : 0, 0, 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(percent)}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            TONES[tone],
            indeterminate && "w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite]",
          )}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
