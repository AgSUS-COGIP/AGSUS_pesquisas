"use client";

import { useEffect } from "react";
import { LOGIN_POPUP_MESSAGE } from "@/lib/login-popup";

/**
 * Última parada da janela de login.
 *
 * Quando o acesso acontece em janela separada, o callback do OAuth manda para
 * cá em vez de mandar para a tela final: a sessão já está gravada nos cookies —
 * que são do mesmo domínio e portanto valem para a janela de trás —, então só
 * falta avisar quem abriu e sair de cena.
 *
 * A pessoa não deve ver esta página. Ela existe por alguns milissegundos, e o
 * texto abaixo só aparece se o fechamento automático for bloqueado.
 */
export default function LoginConcluidoPage() {
  useEffect(() => {
    // Avisa quem abriu, se ainda houver vínculo. É um atalho para a tela de trás
    // não precisar esperar a próxima verificação — nunca a única saída dela.
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: LOGIN_POPUP_MESSAGE }, window.location.origin);
      }
    } catch {
      // Vínculo cortado por política do navegador. A tela de trás percebe a
      // sessão sozinha; aqui só resta sair da frente.
    }

    window.close();

    /*
      `window.close()` pode ser recusado — e foi, no primeiro teste desta tela.
      Quando isso acontece esta página fica parada, aberta, dizendo "pode
      fechar" a quem não pediu para fechar nada.

      Então ela não insiste: segue para o destino e vira uma janela útil do
      sistema. Pior que uma janela a mais é uma janela morta.
    */
    const timer = window.setTimeout(() => {
      if (window.closed) return;
      const destino = new URLSearchParams(window.location.search).get("destino") || "/area";
      window.location.replace(`${destino}${destino.includes("?") ? "&" : "?"}entrando=1`);
    }, 600);

    return () => window.clearTimeout(timer);
  }, []);

  /*
    Esta tela quase nunca é vista: existe por alguns milissegundos entre a
    sessão ser gravada e a janela sair de cena. O texto fala de continuidade,
    não de fechar — se ela chegar a aparecer, é porque o fechamento foi recusado
    e o destino está a caminho.
  */
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--surface-page)] px-6 text-center">
      <div>
        <p className="text-lg font-semibold text-[var(--text-primary)]">Acesso concluído</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Levando você para a plataforma…</p>
      </div>
    </main>
  );
}
