import { Check, Info, ShieldCheck } from "lucide-react";
import {
  ANONYMITY_ADMIN_EFFECTS,
  ANONYMITY_GUARANTEES,
  ANONYMITY_LIMITS,
} from "@/lib/anonymity";
import { cn } from "@/lib/utils";

type AnonymityNoticeProps = {
  /** `respondent` fala com quem responde; `admin`, com quem configura o ciclo. */
  variant: "respondent" | "admin";
  className?: string;
};

/**
 * O que um ciclo anônimo garante, e o que ele não garante.
 *
 * Componente de servidor: não tem estado nem efeito, e o texto vem inteiro de
 * `@/lib/anonymity` para que a promessa feita a quem responde e a descrição
 * lida por quem configura não possam divergir.
 *
 * **As ressalvas não são opcionais.** Elas ficam no mesmo bloco das garantias,
 * e não atrás de um "saiba mais": quem lê só a primeira metade entende
 * "ninguém nunca saberá", o que é falso enquanto o rascunho existe.
 */
export function AnonymityNotice({ variant, className }: AnonymityNoticeProps) {
  const respondent = variant === "respondent";
  const items = respondent ? ANONYMITY_GUARANTEES : ANONYMITY_ADMIN_EFFECTS;

  return (
    <section
      aria-labelledby={`anonimato-${variant}`}
      className={cn(
        "rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-5",
        className,
      )}
    >
      <h2
        id={`anonimato-${variant}`}
        className="flex items-center gap-2 text-sm font-bold text-[var(--status-info-text)]"
      >
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        {respondent ? "Esta avaliação é anônima" : "O que muda com o anonimato"}
      </h2>

      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-[var(--status-info-text)]">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {respondent && (
        <div className="mt-4 border-t border-[var(--status-info-border)] pt-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.08em] text-[var(--text-secondary)]">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            O que continua registrado
          </p>
          <ul className="mt-2 grid gap-2">
            {ANONYMITY_LIMITS.map((item) => (
              <li key={item} className="text-sm leading-6 text-[var(--text-secondary)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
