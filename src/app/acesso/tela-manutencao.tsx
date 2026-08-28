"use client";

import { RefreshCw } from "lucide-react";
import { OFFICIAL_PLATFORM_LOGO_URL } from "@/lib/platform-branding";

/**
 * O que a plataforma mostra quando não consegue falar com o backend.
 *
 * Antes, a porta de entrada abria de qualquer jeito: a marca caía no padrão, a
 * arte de fundo aparecia, e a tela de login ficava idêntica a um dia normal. A
 * pessoa clicava em entrar, o clique não levava a lugar nenhum, e não havia como
 * distinguir "o sistema está fora" de "minha conta tem algum problema" — que são
 * duas situações com providências opostas.
 *
 * A decisão de abrir mesmo sem marca continua certa **para a marca**: arte de
 * campanha indisponível não pode fechar a única porta de entrada. O que faltava
 * era separar isso de a plataforma inteira não responder.
 *
 * Sem logotipo remoto e sem arte de fundo, de propósito: os dois vêm do mesmo
 * backend que acabou de não responder. O logotipo aqui é o arquivo local.
 */
export default function TelaDeManutencao() {
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
          Sistema em manutenção
        </h1>

        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
          Estamos realizando ajustes para melhorar a plataforma neste momento.
          Por favor, tente novamente mais tarde.
        </p>

        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
          Em caso de necessidade, entre em contato com a equipe responsável:
          <br />
          {/*
            `mailto` em vez de texto: no celular, copiar um endereço de uma tela
            de erro é atrito justamente quando a pessoa já está sem conseguir
            entrar.
          */}
          {/*
            `break-all` porque endereço de e-mail não tem espaço para quebrar.
            Medido em tela de 280px: sem isto ele estourava o cartão em 78px e
            era cortado, e a página não rola na horizontal — ou seja, o contato
            ficava ilegível justamente em quem mais precisa dele, no celular.
          */}
          <a
            href="mailto:dados.recursoshumanos@agenciasus.org.br"
            className="break-all font-semibold text-[var(--brand-primary)] underline underline-offset-4"
          >
            dados.recursoshumanos@agenciasus.org.br
          </a>
        </p>

        {/*
          Recarrega a página inteira em vez de refazer só a consulta: a página é
          Server Component, e a decisão de mostrar esta tela é tomada lá. Um
          `router.refresh()` traria o mesmo HTML se o servidor ainda estivesse
          fora, sem sair do lugar.
        */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
