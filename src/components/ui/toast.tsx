"use client";

import * as React from "react";
import { AlertTriangle, CircleAlert, CircleCheck, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastTone = "default" | "success" | "warning" | "destructive";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms. Pass 0 to keep it until dismissed. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastInput, "description">> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4200;

const TONE_STYLES: Record<ToastTone, { icon: React.ElementType; ring: string; iconClass: string }> = {
  default: { icon: Info, ring: "border-border", iconClass: "text-primary" },
  success: { icon: CircleCheck, ring: "border-success/40", iconClass: "text-success" },
  warning: { icon: AlertTriangle, ring: "border-warning/40", iconClass: "text-warning" },
  destructive: { icon: CircleAlert, ring: "border-destructive/40", iconClass: "text-destructive" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = `t_${Math.random().toString(36).slice(2, 9)}`;
      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "default",
        duration: input.duration ?? DEFAULT_DURATION,
      };

      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), record]);

      if (record.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), record.duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const store = timers.current;
    return () => {
      for (const timer of store.values()) clearTimeout(timer);
      store.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ToastRecord[];
  dismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:items-end sm:p-6"
    >
      {toasts.map((entry) => {
        const tone = TONE_STYLES[entry.tone];
        const Icon = tone.icon;
        return (
          <div
            key={entry.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card/95 " +
                "p-3.5 shadow-elevated backdrop-blur-xl animate-slide-in-right",
              tone.ring,
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-foreground">{entry.title}</p>
              {entry.description ? (
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground break-words">
                  {entry.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(entry.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
