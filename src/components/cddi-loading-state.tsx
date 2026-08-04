import { Skeleton } from "@/components/ui/skeleton";

export function CddiLoadingState() {
  return (
    <main
      className="min-h-screen bg-[#eef3f8] px-4 py-5 text-slate-900 sm:px-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Carregando o Ciclo de Devolutivas e Desenvolvimento Individual"
    >
      <div className="mx-auto max-w-[960px] space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Skeleton className="aspect-[4/1] w-full rounded-none" />
        </section>

        <section className="rounded-2xl border-t-[5px] border-[#2d3f97] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-8 w-4/5 max-w-xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-xl bg-[#edf5fc] p-4 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] sm:items-center">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-full max-w-36" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border-l-4 border-emerald-300 bg-white p-5 shadow-sm">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </section>

        <p className="sr-only">Carregando informações, identidade e etapas do CDDI.</p>
      </div>
    </main>
  );
}
