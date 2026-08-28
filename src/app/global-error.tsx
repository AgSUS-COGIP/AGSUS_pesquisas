"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  createErrorReference,
  reportApplicationError,
} from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = useMemo(() => error.digest || createErrorReference(), [error.digest]);

  useEffect(() => {
    void reportApplicationError({
      reference,
      route: typeof window === "undefined" ? "/" : window.location.pathname,
      type: "CLIENTE",
      message: error.message || "Erro inesperado no layout raiz.",
      context: { digest: error.digest ?? null, boundary: "global-error" },
    });
  }, [error.digest, error.message, reference]);

  return (
    /*
      As cores aqui são cravadas de propósito, e continuam assim.

      Este componente renderiza o próprio `<html>` e substitui o layout raiz —
      que é onde `theme-foundation.css` e `globals.css` são importados. Trocar
      estes valores por `var(--…)` arriscaria deixar a tela de última instância
      sem cor nenhuma, exatamente quando ela é a única coisa que restou de pé.

      Pelo mesmo motivo ela não tem tema escuro: não há como ler a preferência
      sem o layout que a aplica.

      O que mudou é só o que não depende de variável — peso de fonte, raio e
      sombra —, para a tela de erro falar a mesma língua do resto da plataforma.
    */
    <html lang="pt-BR">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f5f8fb] px-5 py-12 text-slate-900">
          <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-700">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            {/*
              Saiu a etiqueta "Falha crítica recuperável" em maiúsculas
              espaçadas: ela nomeava a categoria interna do erro, não dizia nada
              a quem está diante da tela, e o vermelho decorativo competia com o
              único vermelho que importa aqui, o do ícone.
            */}
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#003b70]">A plataforma encontrou um problema</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tente recarregar a aplicação. As respostas já confirmadas no banco permanecem preservadas.
            </p>
            <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              Referência técnica: <strong>{reference}</strong>
            </p>
            <button
              type="button"
              onClick={reset}
              className="mx-auto mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#003b70] px-5 text-sm font-semibold text-white transition hover:bg-[#075ea8] focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Recarregar plataforma
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
