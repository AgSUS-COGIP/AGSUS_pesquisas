import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BORDA_DO_TOM, TEXTO_DO_TOM, type TomSemantico } from "@/lib/tom-semantico";

export function Surface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Indicador numérico das telas administrativas e de equipe.
 *
 * ## Por que o tom entra aqui, e não em cada tela
 *
 * Este componente serve onze indicadores em três telas. Escolher a cor em cada
 * chamada faria a mesma pergunta ser respondida onze vezes, e elas divergiriam
 * — que é exatamente o defeito que a gramática semântica veio corrigir no
 * catálogo. Aqui a tela declara **o que o número significa**; a cor é
 * consequência.
 *
 * `tom` ausente vale `total`: o número é uma contagem-base — "Integrantes",
 * "Avaliações", "Perguntas cadastradas" — e permanece visualmente neutro.
 * Assim a cor fica reservada aos indicadores que carregam um estado real, sem
 * transformar o denominador ou o universo da métrica em significado semântico.
 */
export function StatCard({ label, value, description, tom = "total", className }: { label: string; value: ReactNode; description?: string; tom?: TomSemantico; className?: string }) {
  /*
    O traço superior de 3px é o mesmo recurso dos cartões de avaliação, e isso é
    de propósito: um indicador e um cartão passam a marcar situação do mesmo
    jeito, então a leitura aprendida numa tela vale na outra.

    Traço, e não cartão tonalizado: fundo colorido em quatro blocos lado a lado
    transformaria a faixa de indicadores em quatro avisos concorrentes, e o guia
    é explícito contra fundo saturado por bloco.
  */
  return (
    <article className={cn("overflow-hidden rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]", BORDA_DO_TOM[tom], className)}>
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">{label}</p>
      <strong className={cn("mt-2 block text-3xl font-semibold tracking-tight", TEXTO_DO_TOM[tom])}>{value}</strong>
      {description && <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>}
    </article>
  );
}
