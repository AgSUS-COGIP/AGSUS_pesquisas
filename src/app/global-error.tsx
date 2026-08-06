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
    <html lang="pt-BR">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f5f8fb] px-5 py-12 text-slate-900">
          <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.14em] text-red-700">Falha crítica recuperável</p>
            <h1 className="mt-2 text-2xl font-black text-[#003b70]">A plataforma encontrou um problema</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tente recarregar a aplicação. As respostas já confirmadas no banco permanecem preservadas.
            </p>
            <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
              Referência técnica: <strong>{reference}</strong>
            </p>
            <button
              type="button"
              onClick={reset}
              className="mx-auto mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-5 py-3 font-black text-white shadow-lg transition hover:bg-[#075ea8] focus:outline-none focus:ring-4 focus:ring-blue-200"
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
