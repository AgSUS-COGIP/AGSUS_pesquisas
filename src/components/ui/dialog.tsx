"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Modal baseado no elemento `<dialog>` nativo.
 *
 * O navegador cuida de foco, camada superior e `::backdrop`, então não há
 * aprisionamento manual de foco aqui. `onCancel` intercepta o `Escape` para que o
 * fechamento passe pelo estado do React em vez de acontecer só no DOM.
 *
 * Atenção: `src/components/ui/overlay-panel.tsx` exporta outro `Dialog`, com
 * aprisionamento manual de foco e suporte a `footer`. Confira o caminho do import.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "fixed inset-0 z-[100] m-auto max-h-[88vh] w-[min(44rem,calc(100%-2rem))] overflow-hidden rounded-3xl border-0 bg-[var(--surface-card)] p-0 text-left text-[var(--text-primary)] shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="max-h-[88vh] overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-6 backdrop-blur">
          <div>
            {eyebrow && <p className="text-xs font-black uppercase tracking-[.15em] text-[var(--brand-secondary)]">{eyebrow}</p>}
            <h2 id={titleId} className="mt-1 text-2xl font-black text-[var(--brand-primary)]">{title}</h2>
            {description && <p id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Fechar janela"
            onClick={() => onOpenChange(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </dialog>
  );
}
