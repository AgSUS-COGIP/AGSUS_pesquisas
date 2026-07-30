export default function CddiLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[var(--primary)]" />
        <h1 className="mt-5 text-xl font-black text-[var(--primary-dark)]">Carregando CDDI 2026</h1>
        <p className="mt-2 text-sm text-slate-600">Preparando competências, perguntas e escalas.</p>
      </div>
    </main>
  );
}
