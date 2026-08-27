"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { consumeEnteringFlag } from "@/lib/entering-system";
import { timeGreeting, type Greeting } from "@/lib/greeting";

/**
 * Recepção de quem acabou de entrar.
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
 *
 * Aparece **a cada login**, e não uma vez na vida.
 *
 * A primeira versão gravava a dispensa no `localStorage`, e isso guardava a
 * informação no lugar errado: a marca ficava no navegador, então a mesma pessoa
 * era recebida de novo em outra máquina e nunca mais na dela. Pior, ninguém
 * conseguia rever a mensagem depois de dispensá-la uma vez.
 *
 * O sinal certo já existia: o callback do OAuth marca a primeira tela depois do
 * login, e `consumeEnteringFlag()` o gasta uma vez por entrada. Some
 * armazenamento, some chave, some o "nunca mais volta" — recebe quem chegou
 * agora, e some ao ser dispensada ou na próxima navegação.
 */
export function useWelcomeState() {
  // Começa oculta e só aparece depois do efeito: o sinal vive no navegador, e
  // renderizar antes disso não teria como saber se houve login.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consumeEnteringFlag()) setVisible(true);
  }, []);

  return { visible, dismiss: () => setVisible(false) };
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
      className="platform-welcome border-l-[3px] border-[var(--brand-solid)] bg-[var(--surface-card)] px-4 py-3 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/*
            Cumprimenta pelo horário, como se cumprimenta alguém que chega. A
            saudação genérica servia para qualquer hora e por isso não servia
            para nenhuma — quem entra às 19h e lê algo que não reconhece a hora
            sente que o sistema não está prestando atenção.

            Antes de a hora ser resolvida, o título é só o nome: melhor um
            cumprimento a menos que um "bom dia" às onze da noite.
          */}
          <h2 id="boas-vindas-titulo" className="text-sm font-semibold text-[var(--text-primary)]">
            {saudacao ? `${saudacao}, ${firstName}!` : firstName}
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
            Suas avaliações e prazos estão organizados abaixo. Respostas em andamento são salvas automaticamente.
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
