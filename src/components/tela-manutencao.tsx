"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { OFFICIAL_PLATFORM_LOGO_URL } from "@/lib/platform-branding";
import { PLATFORM_SUPPORT_EMAIL } from "@/lib/platform-support";

/**
 * A tela institucional de indisponibilidade, nas suas três situações.
 *
 * ## Por que uma só, com variantes
 *
 * As três dizem a mesma coisa estruturalmente — marca local, um título, um
 * parágrafo, um caminho de volta — e diferem no texto e no desfecho. Três
 * componentes com esse mesmo layout divergiriam na primeira vez que alguém
 * ajustasse o espaçamento de um deles.
 *
 * ## Por que os três estados não podem ter o mesmo nome
 *
 * "Manutenção" é uma decisão de quem opera: alguém escolheu parar a plataforma,
 * e há previsão de volta. Queda de backend é um acidente, sem previsão e sem
 * ninguém avisado. Chamar as duas de manutenção esconde de quem administra que
 * há um incidente acontecendo — e diz a quem usa que está tudo sob controle
 * quando não está.
 *
 * Manutenção de módulo é a terceira: a plataforma está de pé, e apenas uma área
 * saiu do ar. Dizer "sistema em manutenção" ali mandaria a pessoa embora de
 * tudo o que continua funcionando.
 *
 * Nenhuma delas mostra código de erro, mensagem do PostgreSQL ou detalhe de
 * infraestrutura: isso é diagnóstico interno, vai para o log do servidor.
 */
export type TipoDeManutencao = "planejada" | "indisponibilidade" | "modulo";

type Props = {
  tipo: TipoDeManutencao;
  /** Nome institucional do módulo. Obrigatório quando `tipo` é `modulo`. */
  modulo?: string;
  /** Sobrepõe o título institucional. Use apenas quando houver motivo. */
  titulo?: string;
  /** Sobrepõe a mensagem institucional. Use apenas quando houver motivo. */
  mensagem?: string;
};

const TEXTO_PADRAO: Record<TipoDeManutencao, { titulo: string; mensagem: string }> = {
  planejada: {
    titulo: "Sistema em manutenção",
    mensagem:
      "Estamos realizando ajustes para melhorar a plataforma neste momento. Por favor, tente novamente mais tarde.",
  },
  indisponibilidade: {
    titulo: "Sistema temporariamente indisponível",
    mensagem:
      "Não foi possível estabelecer comunicação com os serviços da plataforma neste momento. Por favor, tente novamente mais tarde.",
  },
  modulo: {
    titulo: "Módulo em manutenção",
    mensagem:
      "Estamos realizando ajustes neste módulo. As demais áreas do SIGAV continuam disponíveis.",
  },
};

export default function TelaDeManutencao({ tipo, modulo, titulo, mensagem }: Props) {
  const padrao = TEXTO_PADRAO[tipo];
  const tituloFinal = titulo ?? (tipo === "modulo" && modulo ? `${modulo} em manutenção` : padrao.titulo);
  const mensagemFinal = mensagem ?? padrao.mensagem;

  // O contato institucional pertence a quem ficou sem plataforma. Na manutenção
  // de um módulo o resto do SIGAV continua de pé, e o caminho útil é voltar à
  // visão geral — não abrir um e-mail para o suporte.
  const mostrarContato = tipo !== "modulo";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-page)] px-4 py-10">
      <section
        role="status"
        aria-live="polite"
        className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-[var(--shadow-card)] sm:p-10"
      >
        {/*
          `<img>` simples em vez do componente de imagem: ele otimiza pelo
          servidor, e o servidor é justamente o que pode estar fora. Aqui o
          arquivo é local, pequeno e precisa aparecer sem depender de nada.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OFFICIAL_PLATFORM_LOGO_URL}
          alt=""
          width={56}
          height={56}
          className="mx-auto h-14 w-14 max-w-none object-contain"
        />

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {tituloFinal}
        </h1>

        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{mensagemFinal}</p>

        {mostrarContato && (
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            Em caso de necessidade, entre em contato com a equipe responsável:
            <br />
            {/*
              `mailto` em vez de texto: no celular, copiar um endereço de uma
              tela de erro é atrito justamente quando a pessoa já está sem
              conseguir entrar.

              `break-all` porque endereço de e-mail não tem espaço para quebrar.
              Medido em tela de 280px: sem isto ele estourava o cartão em 78px e
              era cortado, e a página não rola na horizontal — ou seja, o
              contato ficava ilegível justamente em quem mais precisa dele.
            */}
            <a
              href={`mailto:${PLATFORM_SUPPORT_EMAIL}`}
              className="break-all font-semibold text-[var(--brand-primary)] underline underline-offset-4"
            >
              {PLATFORM_SUPPORT_EMAIL}
            </a>
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {tipo === "modulo" && (
            <Link
              href="/area"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar à visão geral
            </Link>
          )}

          {/*
            Recarrega a página inteira em vez de refazer só a consulta: a decisão
            de mostrar esta tela é tomada no servidor. Um `router.refresh()`
            traria o mesmo HTML se o servidor ainda estivesse fora, sem sair do
            lugar.
          */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={
              tipo === "modulo"
                ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            }
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </section>
    </main>
  );
}
