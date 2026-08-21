import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selo "i" que revela um texto explicativo no hover ou no foco — para
 * conteúdo de apoio que não precisa ficar sempre visível na tela. `id` é
 * escolhido por quem chama (mesma convenção manual de `PeriodField`), porque
 * este é um componente de servidor e não pode gerar um com `useId()`.
 *
 * `aria-describedby` aponta para o texto independente do hover: leitor de
 * tela lê o conteúdo ao focar o botão, mesmo com a bolha em `opacity-0`.
 */
export function InfoTooltip({ id, label = "Mais informações", side = "bottom", className, children }: {
  id: string;
  label?: string;
  side?: "bottom" | "top";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        aria-describedby={id}
        aria-label={label}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-20 w-64 max-w-[calc(100vw-2.5rem)] -translate-x-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 text-xs leading-5 text-[var(--text-secondary)] opacity-0 shadow-[0_18px_45px_-20px_rgba(15,23,42,.45)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
        )}
      >
        {children}
      </span>
    </span>
  );
}
