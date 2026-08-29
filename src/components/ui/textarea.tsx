import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[8rem] w-full resize-y rounded-xl border border-input bg-background px-4 py-3 " +
        "font-mono text-[13px] leading-relaxed text-foreground transition-colors " +
        "placeholder:font-sans placeholder:text-muted-foreground/70 focus-visible:border-ring " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 " +
        "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
