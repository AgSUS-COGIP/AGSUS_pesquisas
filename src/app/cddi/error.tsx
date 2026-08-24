"use client";

import Link from "next/link";

export default function CddiError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
        {/* Sem o ano: este boundary aparece justamente quando a tela NAO conseguiu
            carregar o ciclo, entao nomear um seria afirmar o que nao se sabe. */}
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">CDDI</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--primary-dark)]">Não foi possível abrir o formulário</h1>
        <p className="mt-4 leading-7 text-slate-600">Tente carregar novamente. Caso o erro continue, registre o horário e encaminhe à equipe responsável.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-xl bg-[var(--primary)] px-5 py-3 font-black text-white">Tentar novamente</button>
          <Link href="/" className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 font-black text-slate-700">Voltar ao início</Link>
        </div>
      </div>
    </main>
  );
}
