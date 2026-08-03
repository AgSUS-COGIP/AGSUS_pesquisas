"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type OverlayPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  type?: "dialog" | "drawer";
  side?: "right" | "left";
  className?: string;
  closeLabel?: string;
};

export function OverlayPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  type = "dialog",
  side = "right",
  className,
  closeLabel = "Fechar",
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
    window.requestAnimationFrame(() => (firstFocusable ?? panel)?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const drawerPosition = side === "right" ? "right-0 border-l" : "left-0 border-r";
  const panelClass = type === "drawer"
    ? cn("fixed inset-y-0 z-[91] flex w-full max-w-lg flex-col border-slate-200 bg-white shadow-2xl", drawerPosition, className)
    : cn("relative z-[91] flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl", className);

  return (
    <div className={cn("fixed inset-0 z-[90]", type === "dialog" && "grid place-items-center p-4")}>
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={panelClass}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">{footer}</footer>}
      </div>
    </div>
  );
}

export function Dialog(props: Omit<OverlayPanelProps, "type" | "side">) {
  return <OverlayPanel {...props} type="dialog" />;
}

export function Drawer(props: Omit<OverlayPanelProps, "type">) {
  return <OverlayPanel {...props} type="drawer" />;
}
