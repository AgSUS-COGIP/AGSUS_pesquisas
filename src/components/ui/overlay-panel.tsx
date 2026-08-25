"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
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

export type OverlayPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  type?: "dialog" | "drawer";
  side?: "right" | "left";
  id?: string;
  className?: string;
  contentClassName?: string;
  closeLabel?: string;
};

function visibleFocusableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
}

/**
 * Painel modal acessível, com aprisionamento de foco.
 *
 * Guarda o elemento focado antes de abrir, trava o scroll da página, foca o
 * primeiro elemento interativo, circula `Tab`/`Shift+Tab` dentro do painel, fecha
 * com `Escape` e devolve o foco ao elemento de origem ao fechar.
 *
 * Prefira {@link Dialog} e {@link Drawer} — este componente é a implementação
 * comum das duas variantes.
 */
export function OverlayPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  type = "dialog",
  side = "right",
  id,
  className,
  contentClassName,
  closeLabel = "Fechar",
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const titleId = useId();
  const descriptionId = useId();

  // O callback é lido de um ref para que o efeito de abertura dependa apenas de
  // `open`: um `onOpenChange` recriado a cada render remontaria os listeners e
  // roubaria o foco do usuário no meio da interação.
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = panel ? visibleFocusableElements(panel)[0] : null;
      (firstFocusable ?? panel)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = visibleFocusableElements(panel);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1)!;
      const activeElement = document.activeElement;

      if (!panel.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const drawerPosition = side === "right" ? "right-0 border-l" : "left-0 border-r";
  const panelClass = type === "drawer"
    ? cn("fixed inset-y-0 z-[91] flex w-full max-w-lg flex-col overflow-hidden border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xl", drawerPosition, className)
    : cn("relative z-[91] flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xl", className);

  return (
    <div className={cn("fixed inset-0 z-[90]", type === "dialog" && "grid place-items-center p-4")}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={() => onOpenChangeRef.current(false)}
      />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={panelClass}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChangeRef.current(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6", contentClassName)}>{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-4 sm:px-6">{footer}</footer>}
      </div>
    </div>
  );
}

/**
 * Modal centralizado.
 *
 * Atenção: `src/components/ui/dialog.tsx` exporta outro componente chamado
 * `Dialog`, baseado no elemento `<dialog>` nativo. Confira o caminho do import.
 */
export function Dialog(props: Omit<OverlayPanelProps, "type" | "side">) {
  return <OverlayPanel {...props} type="dialog" />;
}

/** Painel lateral deslizante. Usado pela navegação móvel da casca. */
export function Drawer(props: Omit<OverlayPanelProps, "type">) {
  return <OverlayPanel {...props} type="drawer" />;
}
