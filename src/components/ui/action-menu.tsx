"use client";

import { MoreVertical } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: typeof MoreVertical;
  onSelect: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  title?: string;
};

/**
 * Menu de ações ancorado ao botão de 3 pontos, para cartões com mais opções do
 * que cabem como botões lado a lado. Fecha ao clicar fora, ao pressionar
 * Escape ou ao selecionar um item — não é modal, então não trava o scroll da
 * página nem usa o `Dialog` de foco preso.
 */
export function ActionMenu({ label, items, className }: {
  label: string;
  items: ActionMenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)]"
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-1.5 shadow-[var(--shadow-card)]"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                  item.tone === "danger"
                    ? "text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
