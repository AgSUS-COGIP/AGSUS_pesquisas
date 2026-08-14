"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { timeGreeting, type Greeting } from "@/lib/greeting";

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
/**
 * Estado da recepção, exposto para a tela poder se ajustar a ele.
 *
 * A página precisa saber se a faixa está no ar: quando está, ela já cumprimenta
 * pelo nome, e o bloco de identificação logo abaixo não pode cumprimentar de
 * novo — "Boas-vindas, YASSURY" seguido de "Boa tarde, YASSURY" é a mesma
 * saudação duas vezes, uma sob a outra.
 */
export function useWelcomeState(personId: string) {
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
      // Sem armazenamento, a faixa volta na próxima visita. É a degradação
      // aceitável: ela informa, não bloqueia.
    }
  }

  return { visible, dismiss };
}

export function PlatformWelcome({ visible, onDismiss, firstName }: { visible: boolean; onDismiss: () => void; firstName: string }) {
  /*
    A saudação é resolvida depois da montagem, nunca no servidor: o HTML é
    gerado uma vez e serviria "Bom dia" a quem abrisse à noite. É o mesmo
    cuidado que a Visão geral já tinha com a saudação dela.
  */
  const [saudacao, setSaudacao] = useState<Greeting | null>(null);
  useEffect(() => setSaudacao(timeGreeting()), []);

  if (!visible) return null;

  return (
    <section
      aria-labelledby="boas-vindas-titulo"
      className="platform-welcome relative overflow-hidden rounded-2xl border border-[var(--brand-primary)]/20 bg-[linear-gradient(120deg,var(--status-info-bg),var(--surface-card))] p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      {/* Brilho de canto: dá vida sem competir com o texto. Decorativo, então
          fica fora da árvore de acessibilidade. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--brand-solid)] opacity-[.07] blur-2xl"
      />
      <div className="relative flex items-start gap-4">
        <span className="platform-welcome-badge grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-solid)] text-[var(--text-on-brand)]" aria-hidden="true">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {/*
            Cumprimenta pelo horário, como se cumprimenta alguém que chega. A
            saudação genérica servia para qualquer hora e por isso não servia
            para nenhuma — quem entra às 19h e lê algo que não reconhece a hora
            sente que o sistema não está prestando atenção.

            Antes de a hora ser resolvida, o título é só o nome: melhor um
            cumprimento a menos que um "bom dia" às onze da noite.
          */}
          <h2 id="boas-vindas-titulo" className="text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-xl">
            {saudacao ? `${saudacao}, ${firstName}!` : firstName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Que bom ter você aqui. Esta é a plataforma de avaliações da AgSUS — é por aqui que você responde o que for
            liberado para o seu perfil e acompanha os prazos, sem pressa.{" "}
            <strong className="font-semibold text-[var(--text-primary)]">Cada resposta é salva na hora</strong>, então dá
            para parar quando precisar e voltar exatamente de onde ficou.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar as boas-vindas"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
