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
    // `window.opener` some se a janela for aberta fora do fluxo esperado; nesse
    // caso não há a quem avisar, e o `location.replace` abaixo resolve sozinho.
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: LOGIN_POPUP_MESSAGE }, window.location.origin);
      window.close();
      return;
    }

    // Sem janela de trás: esta virou a janela principal. Segue para o destino
    // como se o login tivesse sido pelo caminho tradicional.
    const destino = new URLSearchParams(window.location.search).get("destino") || "/area";
    window.location.replace(`${destino}${destino.includes("?") ? "&" : "?"}entrando=1`);
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b3b52] px-6 text-center text-white">
      <div>
        <p className="text-lg font-semibold">Acesso concluído</p>
        <p className="mt-2 text-sm text-white/70">Você já pode fechar esta janela.</p>
      </div>
    </main>
  );
}
