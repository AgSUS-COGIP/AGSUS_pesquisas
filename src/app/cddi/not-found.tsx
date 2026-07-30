import Link from "next/link";

export default function CddiNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--primary)]">CDDI</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--primary-dark)]">Formulário não encontrado</h1>
        <p className="mt-4 leading-7 text-slate-600">A definição solicitada não está publicada ou disponível para consulta.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 font-black text-white">Voltar ao início</Link>
      </div>
    </main>
  );
}
