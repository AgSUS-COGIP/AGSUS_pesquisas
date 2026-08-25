import { Skeleton } from "./ui/skeleton";

export function PlatformSkeleton({ title = "Carregando", showProgress = false }: { title?: string; showProgress?: boolean }) {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
      className="min-h-screen bg-[var(--surface-page)]"
    >
      <aside
        className="fixed inset-y-0 left-0 hidden w-[14.5rem] border-r border-slate-200 bg-white lg:block"
        aria-hidden="true"
      >
        <div className="h-[72px] border-b border-slate-100 p-4">
          <Skeleton className="h-10 w-36 rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-11 rounded-xl bg-slate-100" />
          ))}
        </div>
      </aside>

      <div className="lg:pl-[14.5rem]">
        <header className="h-[72px] border-b border-slate-200 bg-white px-6 py-5" aria-hidden="true">
          <Skeleton className="h-6 w-56 bg-slate-100" />
        </header>
        <div className="mx-auto max-w-[1380px] px-5 py-6" aria-hidden="true">
          <Skeleton className="h-36 rounded-2xl bg-white ring-1 ring-slate-200" />
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl bg-white ring-1 ring-slate-200" />
            ))}
          </div>
        </div>
        {showProgress ? (
          <div className="mx-auto flex max-w-md items-center justify-center gap-3 px-5 pb-8 text-[var(--text-secondary)]">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--brand-primary)] motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">{title}…</p>
          </div>
        ) : null}
      </div>

      <span className="sr-only">{title}</span>
    </main>
  );
}
