"use client";

import Link from "next/link";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function SurveysPage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando pesquisas" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  const application = context.application;
  const status = application?.status === "OPEN" ? "Aberta" : application?.status === "CLOSED" ? "Encerrada" : "Em preparação";
  const actionLabel = application?.status === "OPEN" ? "Responder pesquisa" : "Consultar formulário";

  return (
    <PlatformShell
      user={{ fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules }}
      eyebrow="Catálogo institucional"
      title="Pesquisas"
    >
      <section className="rounded-3xl border-t-4 border-blue-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Pesquisas disponíveis</p>
            <h2 className="mt-1 text-2xl font-black text-[#003b70]">Formulários vinculados ao seu perfil</h2>
            <p className="mt-2 text-slate-600">Inicie, continue ou consulte pesquisas conforme o período e suas permissões.</p>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Pesquisar por título ou ciclo</div>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#d7e5f2]">
          <div className="h-2 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" />
          <div className="p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">CDDI 2026</span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${status === "Aberta" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{status}</span>
            </div>
            <h3 className="mt-5 text-2xl font-black text-[#003b70]">Ciclo de Devolutivas e Desenvolvimento Individual</h3>
            <p className="mt-3 leading-7 text-slate-600">Autoavaliação, avaliação da liderança, devolutivas e ações de desenvolvimento estruturadas por competências.</p>
            <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-500">Perfil</dt><dd className="mt-1 font-black text-slate-800">{context.isLeader ? "Participante e liderança" : "Participante"}</dd></div>
              <div><dt className="text-slate-500">Situação</dt><dd className="mt-1 font-black text-slate-800">{context.participant?.status ?? "Elegível"}</dd></div>
              <div><dt className="text-slate-500">Conclusão</dt><dd className="mt-1 font-black text-slate-800">{context.participant?.completedAt ? "Concluída" : "Não concluída"}</dd></div>
            </dl>
            <Link href="/cddi" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#003b70] px-5 py-3 font-black text-white hover:bg-[#075ea8]">{actionLabel}</Link>
          </div>
        </article>

        <article className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-7">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Novas pesquisas</span>
          <h3 className="mt-5 text-2xl font-black text-[#003b70]">Próximos ciclos</h3>
          <p className="mt-3 leading-7 text-slate-600">Novos formulários aparecerão automaticamente nesta área quando forem publicados e liberados para seu perfil.</p>
        </article>
      </div>
    </PlatformShell>
  );
}
