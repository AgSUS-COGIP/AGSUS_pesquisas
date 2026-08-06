"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { createErrorReference, reportApplicationError } from "@/lib/observability";

export default function RouteError({
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
      route: window.location.pathname,
      type: "CLIENTE",
      message: error.message || "Erro inesperado na rota.",
      context: { digest: error.digest ?? null },
    });
  }, [error.digest, error.message, reference]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-page)] px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.14em] text-[var(--status-danger-text)]">Falha recuperável</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">Não foi possível concluir esta operação</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Seus dados já salvos permanecem protegidos. Tente carregar novamente ou retorne à tela inicial.
        </p>
        <p className="mt-4 rounded-xl bg-[var(--surface-interactive)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Referência técnica: <strong className="text-[var(--text-primary)]">{reference}</strong>
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="primary-button inline-flex justify-center gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
          </button>
          <Link href="/" className="secondary-button inline-flex justify-center gap-2">
            <Home className="h-4 w-4" aria-hidden="true" /> Tela inicial
          </Link>
        </div>
      </section>
    </main>
  );
}
