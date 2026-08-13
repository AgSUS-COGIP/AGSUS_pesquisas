"use client";

import { Mail } from "lucide-react";
import { PLATFORM_SUPPORT_EMAIL, gmailComposeHref, supportMailtoHref } from "@/lib/platform-support";

/**
 * Contato de suporte do rodapé.
 *
 * O link `mailto:` sozinho não servia: ele entrega a mensagem ao cliente de
 * e-mail **padrão do sistema**, que no Windows é o Outlook, enquanto a AgSUS
 * usa Gmail. O operador clicava e caía num programa que nem usa.
 *
 * A saída são três caminhos explícitos em vez de um implícito: abrir no Gmail
 * (o caso comum aqui), copiar o endereço (serve para qualquer cliente, inclusive
 * celular) e o `mailto:` como alternativa para quem realmente tem cliente
 * configurado. Nenhum deles depende de infraestrutura de envio.
 */
export function PlatformSupportContact() {

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
      <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Precisa de ajuda?
      </span>
      <a
        href={gmailComposeHref()}
        target="_blank"
        rel="noopener noreferrer"
        title={`Abrir uma mensagem para ${PLATFORM_SUPPORT_EMAIL} no Gmail`}
        className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        Abrir no Gmail
      </a>
      {/*
        O botão "Copiar endereço" saiu: com "Abrir no Gmail" resolvendo o caso
        real, ele era um terceiro caminho para a mesma coisa. O endereço em si
        continua clicável — quem tem cliente de e-mail configurado usa, e quem
        quiser anotar consegue selecionar o texto.
      */}
      <a
        href={supportMailtoHref()}
        title="Abrir no programa de e-mail configurado neste computador"
        className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {PLATFORM_SUPPORT_EMAIL}
      </a>
    </div>
  );
}
