import { ArrowLeft, Home, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-page)] px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.14em] text-[var(--brand-primary)]">Página não encontrada</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">Este endereço não está disponível</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          O conteúdo pode ter sido movido, encerrado ou você pode não possuir acesso a esta área.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="primary-button inline-flex justify-center gap-2">
            <Home className="h-4 w-4" aria-hidden="true" /> Tela inicial
          </Link>
          <Link href="/pesquisas" className="secondary-button inline-flex justify-center gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ver formulários
          </Link>
        </div>
      </section>
    </main>
  );
}
