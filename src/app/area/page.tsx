"use client";

import { ArrowRight, BarChart3, Building2, CalendarClock, CheckCircle2, FileText, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

function metadataText(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function ParticipantAreaPage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Preparando painel institucional" />;
  if (!context?.person || context.status !== "OK") {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] text-red-700">Acesso institucional</p><h1 className="mt-2 text-2xl font-black text-[#003b70]">Não foi possível abrir seu painel</h1><p className="mt-4 leading-7 text-slate-600">{error || context?.message || "Cadastro institucional não localizado."}</p><Link href="/acesso" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao acesso</Link></section></main>;
  }

  const person = context.person;
  const modules = deriveModules(context);
  const isLeader = modules.includes("TEAM");
  const isAdmin = modules.some((item) => item.startsWith("ADMIN_"));
  const closed = context.application?.status === "CLOSED";
  const completed = Boolean(context.participant?.completedAt);
  const firstName = person.fullName.split(/\s+/)[0];
  const avatarUrl = metadataText(person.metadata, "avatar_url", "avatarUrl", "picture", "photo_url");
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter ?? "Unidade não informada";
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const profile = profileLabel(context);
  const statusLabel = completed ? "Concluída" : closed ? "Encerrada" : "Pendente";
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profile, avatarUrl, roles: context.roles, modules };

  const actions = [
    { href: "/pesquisas", title: "Pesquisas", text: closed ? "Consultar instrumentos" : "Continuar preenchimentos", icon: FileText, accent: "text-blue-700 bg-blue-50" },
    ...(isLeader ? [{ href: "/equipe", title: "Minha equipe", text: "Integrantes e avaliações", icon: Users2, accent: "text-emerald-700 bg-emerald-50" }] : []),
    { href: "/resultados", title: "Resultados", text: "Devolutivas e indicadores", icon: BarChart3, accent: "text-violet-700 bg-violet-50" },
    ...(isAdmin ? [{ href: "/admin", title: "Administração", text: "Pesquisas, pessoas e acessos", icon: ShieldCheck, accent: "text-amber-700 bg-amber-50" }] : []),
  ];

  return (
    <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">{greeting()},</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-[#003b70]">{firstName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Acompanhe suas pesquisas, equipe e resultados em um único espaço.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3"><span className="text-[11px] font-bold text-slate-500">Perfil</span><strong className="mt-1 block text-sm text-slate-900">{profile}</strong></div>
              <div className="rounded-xl bg-slate-50 px-4 py-3"><span className="text-[11px] font-bold text-slate-500">Módulos</span><strong className="mt-1 block text-xl text-[#003b70]">{modules.length}</strong></div>
              <div className="col-span-2 rounded-xl bg-slate-50 px-4 py-3 sm:col-span-1"><span className="text-[11px] font-bold text-slate-500">CDDI 2026</span><strong className={`mt-1 block text-sm ${completed ? "text-emerald-700" : closed ? "text-amber-700" : "text-blue-700"}`}>{statusLabel}</strong></div>
            </div>
          </div>
        </article>

        <aside className="rounded-2xl border border-slate-200 bg-[#003b70] p-5 text-white shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-cyan-200">Pesquisa atual</p><h3 className="mt-2 text-xl font-black">CDDI 2026</h3></div>{completed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CalendarClock className="h-5 w-5 text-amber-300" />}</div>
          <p className="mt-3 text-sm leading-6 text-blue-100">Ciclo de Devolutivas e Desenvolvimento Individual.</p>
          <Link href="/cddi" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#003b70] transition hover:bg-blue-50">{closed ? "Consultar" : completed ? "Revisar" : "Continuar"}<ArrowRight className="h-4 w-4" /></Link>
        </aside>
      </section>

      {closed && <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><CalendarClock className="h-4 w-4 shrink-0" /><span><strong>Período encerrado.</strong> O instrumento permanece disponível para consulta.</span></div>}

      <section className="mt-5 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Ações rápidas</p><h2 className="mt-1 text-lg font-black text-[#003b70]">Acessos principais</h2></div><Link href="/perfil" className="text-xs font-black text-emerald-700">Perfil →</Link></div>
          <div className="mt-4 divide-y divide-slate-100">
            {actions.map(({ href, title, text, icon: Icon, accent }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{title}</strong><small className="block truncate text-xs text-slate-500">{text}</small></span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#003b70]" />
              </Link>
            ))}
          </div>
        </aside>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1fr_280px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Jornada atual</p><h2 className="mt-1 text-xl font-black text-[#003b70]">Ciclo de Devolutivas e Desenvolvimento Individual</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-800">CDDI 2026</span></div>
              <p className="mt-3 text-sm leading-6 text-slate-600">Avaliação estruturada por competências, com autoavaliação, avaliação da liderança e ações de desenvolvimento.</p>
              <div className="mt-5 grid grid-cols-3 gap-3">{[["12","competências"],["52","perguntas"],["13","etapas"]].map(([value,label]) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-3"><strong className="block text-xl text-[#003b70]">{value}</strong><span className="text-[11px] text-slate-500">{label}</span></div>)}</div>
              <Link href="/cddi" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#003b70]">Abrir instrumento <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="flex min-h-52 items-center justify-center border-t border-slate-100 bg-sky-50/60 p-5 lg:border-l lg:border-t-0"><img src="https://i.postimg.cc/fTtNN9PM/Automatizacao-de-instrumento.png" alt="Ilustração do CDDI" className="max-h-36 w-full object-contain" /></div>
          </div>
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-[#003b70]"><Building2 className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Identidade institucional</p><h3 className="text-sm font-black text-slate-900">{person.fullName}</h3></div></div>
          <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-3"><span><strong className="block text-slate-400">Cargo</strong>{person.jobTitle ?? "Não informado"}</span><span><strong className="block text-slate-400">Unidade</strong>{unit}</span>{coordination && <span><strong className="block text-slate-400">Coordenação</strong>{coordination}</span>}</div>
        </div>
      </section>
    </PlatformShell>
  );
}
