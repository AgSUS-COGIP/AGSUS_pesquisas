"use client";

import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function ResultsPage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando resultados" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);

  return (
    <PlatformShell user={{ fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules }} eyebrow="Devolutivas e publicações" title="Meus resultados">
      <section className="rounded-3xl border-t-4 border-amber-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Resultados individuais</p>
        <h2 className="mt-1 text-2xl font-black text-[#003b70]">Publicações disponíveis</h2>
        <p className="mt-2 text-slate-600">Resultados, devolutivas e planos de desenvolvimento aparecerão após a publicação administrativa do ciclo.</p>
      </section>

      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl">◔</div>
        <h3 className="mt-5 text-xl font-black text-[#003b70]">Nenhum resultado publicado</h3>
        <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">O histórico de participação está preservado. Esta área será atualizada quando a administração liberar os resultados do CDDI ou de outras pesquisas.</p>
      </div>
    </PlatformShell>
  );
}
