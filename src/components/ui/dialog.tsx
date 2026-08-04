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
        "fixed inset-0 z-[100] m-auto max-h-[88vh] w-[min(44rem,calc(100%-2rem))] overflow-hidden rounded-3xl border-0 bg-white p-0 text-left shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="max-h-[88vh] overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-6 backdrop-blur">
          <div>
            {eyebrow && <p className="text-xs font-black uppercase tracking-[.15em] text-[#0b8f58]">{eyebrow}</p>}
            <h2 id={titleId} className="mt-1 text-2xl font-black text-[#003b70]">{title}</h2>
            {description && <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Fechar janela"
            onClick={() => onOpenChange(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </dialog>
  );
}
