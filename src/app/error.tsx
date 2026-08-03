"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erro global da aplicação", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_15%,rgba(239,68,68,.08),transparent_32%),#f5f8fb] px-6">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-[0_30px_80px_-45px_rgba(15,23,42,.55)] backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-red-700">Falha temporária</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[#003b70]">Não foi possível concluir esta ação</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Tente carregar novamente. Caso o problema continue, o identificador abaixo ajuda a Equipe Técnica na análise.</p>
        {error.digest && <code className="mt-5 inline-flex rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">{error.digest}</code>}
        <button type="button" onClick={reset} className="mx-auto mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#003b70] px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#075ea8] focus:outline-none focus:ring-4 focus:ring-blue-200">
          <RotateCcw className="h-5 w-5" />
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
