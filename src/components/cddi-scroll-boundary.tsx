"use client";

import { useEffect } from "react";

/**
 * Aplica o comportamento de scroll específico da rota `/cddi`.
 *
 * O formulário tem rodapé fixo com navegação e salvamento, o que exige regras de
 * scroll diferentes da tela inicial do módulo. Como as duas telas vivem no mesmo
 * componente de página, a distinção é feita observando o DOM: a presença de
 * `<footer>` dentro do `<main>` significa "modo formulário".
 *
 * Isso acopla este componente à hierarquia de `src/app/cddi/page.tsx` — alterar a
 * estrutura daquela página exige revisar `applyMode()`.
 */
export function CddiScrollBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("cddi-route-active");
    body.classList.add("cddi-route-active");

    const applyMode = () => {
      const main = document.querySelector<HTMLElement>(".cddi-route-shell > main");
      const footer = main?.querySelector<HTMLElement>(":scope > footer");
      const content = main?.querySelector<HTMLElement>(":scope > div");
      const banner = content?.firstElementChild instanceof HTMLElement ? content.firstElementChild : null;

      main?.classList.toggle("cddi-form-mode", Boolean(footer));
      content?.classList.toggle("cddi-form-content", Boolean(footer));
      banner?.classList.toggle("cddi-form-banner", Boolean(footer));
    };

    applyMode();
    // A troca entre tela inicial e formulário acontece por estado do React, sem
    // mudar de rota, então o observer é o que reavalia o modo.
    const observer = new MutationObserver(applyMode);
    observer.observe(document.querySelector(".cddi-route-shell") ?? body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      html.classList.remove("cddi-route-active");
      body.classList.remove("cddi-route-active");
    };
  }, []);

  return <div className="cddi-route-shell">{children}</div>;
}
