"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_PREFIX = "agsus-boas-vindas-v1:";

/**
 * Recepção da primeira visita.
 *
 * Aparece uma vez por pessoa e some ao ser dispensada — quem já conhece a
 * plataforma não é recebido de novo toda vez que entra. A chave inclui a
 * **matrícula**, que é como este projeto identifica a pessoa: em máquina
 * compartilhada, a mensagem de uma não cala a da próxima.
 *
 * **Não usa o confete de `CompletionCelebration`.** Confete é para conquista;
 * chegar não é uma. Gastá-lo aqui barateia o momento que ele existe para
 * marcar — concluir a avaliação. A recepção pede acolhimento, não festa.
 *
 * Também não é modal: ninguém precisa fechar uma caixa para começar a usar o
 * sistema. É uma faixa que informa e sai de cena.
 */
export function PlatformWelcome({ personId, firstName }: { personId: string; firstName: string }) {
  // Começa oculta e só aparece depois de consultar o armazenamento: renderizar
  // primeiro e esconder depois faria a faixa piscar para quem já a dispensou.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!personId) return;
    try {
      if (!window.localStorage.getItem(`${STORAGE_PREFIX}${personId}`)) setVisible(true);
    } catch {
      // Armazenamento indisponível (navegação privada, bloqueio de terceiros):
      // não mostrar é melhor que mostrar toda vez sem conseguir dispensar.
    }
  }, [personId]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${personId}`, new Date().toISOString());
    } catch {
      // Sem armazenamento, a faixa volta na próxima visita. É o degradação
      // aceitável: ela informa, não bloqueia.
    }
  }

  if (!visible) return null;

  return (
    <section
      aria-labelledby="boas-vindas-titulo"
      className="relative overflow-hidden rounded-2xl border border-[var(--brand-primary)]/20 bg-[linear-gradient(120deg,var(--status-info-bg),var(--surface-card))] p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-solid)] text-[var(--text-on-brand)]" aria-hidden="true">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {/* "Boas-vindas" no lugar de "Bem-vindo(a)": acolhe sem precisar de
              barra, parênteses ou suposição sobre quem está lendo. */}
          <h2 id="boas-vindas-titulo" className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Boas-vindas, {firstName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Esta é a plataforma de avaliações da AgSUS. Aqui você responde o que for liberado para o seu perfil e
            acompanha os prazos. <strong className="font-semibold text-[var(--text-primary)]">Suas respostas são salvas
            automaticamente</strong> — dá para parar e continuar depois de onde ficou.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar as boas-vindas"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
