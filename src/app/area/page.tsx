"use client";

import { ArrowRight, BarChart3, Building2, CheckCircle2, Clock3, FileText, ShieldCheck, Sparkles, Users2 } from "lucide-react";
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
  if (!context?.person || context.status !== "OK") return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6"><section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Acesso institucional</p><h1 className="mt-2 text-3xl font-black text-[#003b70]">Não foi possível abrir seu painel</h1><p className="mt-4 leading-7 text-slate-600">{error || context?.message || "Cadastro institucional não localizado."}</p><Link href="/acesso" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao acesso</Link></section></main>;

  const person = context.person;
  const modules = deriveModules(context);
  const isLeader = modules.includes("TEAM");
  const isAdmin = modules.some((item) => item.startsWith("ADMIN_"));
  const closed = context.application?.status === "CLOSED";
  const firstName = person.fullName.split(/\s+/)[0];
  const avatarUrl = metadataText(person.metadata, "avatar_url", "avatarUrl", "picture", "photo_url");
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter ?? "Unidade não informada";
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const completed = Boolean(context.participant?.completedAt);
  const statusLabel = completed ? "Concluída" : closed ? "Prazo encerrado" : "Pendente";
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), avatarUrl, roles: context.roles, modules };

  const quickActions = [
    { href: "/pesquisas", title: "Minhas pesquisas", text: closed ? "Consultar instrumentos disponíveis" : "Continuar preenchimentos e acompanhar prazos", icon: FileText, tone: "bg-blue-50 text-blue-700" },
    ...(isLeader ? [{ href: "/equipe", title: "Minha equipe", text: "Gerenciar integrantes e avaliações", icon: Users2, tone: "bg-emerald-50 text-emerald-700" }] : []),
    { href: "/resultados", title: "Resultados", text: "Acompanhar devolutivas e indicadores liberados", icon: BarChart3, tone: "bg-violet-50 text-violet-700" },
    ...(isAdmin ? [{ href: "/admin", title: "Equipe Técnica", text: "Criar pesquisas e administrar a plataforma", icon: ShieldCheck, tone: "bg-amber-50 text-amber-700" }] : []),
  ];

  return <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_82%_15%,rgba(45,212,191,.24),transparent_27%),radial-gradient(circle_at_15%_90%,rgba(56,189,248,.18),transparent_32%),linear-gradient(125deg,#012b50,#064f89_58%,#0878a6)] p-6 text-white shadow-[0_24px_60px_rgba(0,47,89,.22)] sm:p-8 lg:p-10">
      <div className="relative grid gap-8 xl:grid-cols-[1.3fr_.7fr] xl:items-end">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-emerald-100 backdrop-blur"><Sparkles className="h-4 w-4" />{profileLabel(context)} · ambiente seguro</span>
          <p className="mt-8 text-sm font-bold text-blue-100">{greeting()},</p>
          <h2 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{firstName}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100">Seu espaço para responder pesquisas, acompanhar equipes, consultar resultados e administrar ciclos institucionais.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/pesquisas" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#003b70] shadow-lg transition hover:-translate-y-0.5"><FileText className="h-4 w-4" />Abrir pesquisas</Link>{isAdmin && <Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-200/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-emerald-200/20"><ShieldCheck className="h-4 w-4" />Equipe Técnica</Link>}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl"><div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">Pesquisa atual</span>{completed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Clock3 className="h-5 w-5 text-amber-300" />}</div><strong className="mt-3 block text-2xl">CDDI 2026</strong><span className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-black ${completed ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}>{statusLabel}</span></div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl"><span className="text-xs font-bold text-blue-100">Seu ambiente</span><strong className="mt-3 block text-3xl">{modules.length}</strong><span className="mt-2 block text-xs leading-5 text-blue-100">módulos liberados conforme seu perfil</span></div>
        </div>
      </div>
    </section>

    {closed && <div className="mt-5 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>O período do CDDI 2026 foi encerrado.</strong><p className="mt-1 text-sm leading-6 text-amber-800">O instrumento continua disponível para consulta conforme suas permissões.</p></div></div>}

    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Acesso rápido</p><h2 className="mt-1 text-2xl font-black text-[#003b70]">O que você precisa fazer agora?</h2></div><Link href="/perfil" className="text-sm font-black text-[#0b8f58]">Personalizar meu perfil →</Link></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{quickActions.map(({ href, title, text, icon: Icon, tone }) => <Link key={href} href={href} className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-black text-[#003b70]">{title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0b8f58]">Abrir <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>)}</div></section>

    <section className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-sm"><div className="grid lg:grid-cols-[1fr_.55fr]"><div className="p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Jornada atual</p><h3 className="mt-2 text-2xl font-black text-[#003b70]">Ciclo de Devolutivas e Desenvolvimento Individual</h3></div><span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-800">CDDI 2026</span></div><p className="mt-4 max-w-3xl leading-7 text-slate-600">Avaliação estruturada por competências, com autoavaliação, avaliação da liderança, devolutiva e ações de desenvolvimento.</p><div className="mt-6 flex flex-wrap gap-3">{[["12","competências"],["52","perguntas"],["13","etapas"]].map(([value,label]) => <div key={label} className="min-w-28 rounded-2xl bg-slate-50 px-4 py-3"><strong className="block text-2xl text-[#003b70]">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>)}</div><Link href="/cddi" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-5 py-3 font-black text-white transition hover:bg-[#075ea8]">{closed ? "Consultar formulário" : completed ? "Revisar envio" : "Continuar avaliação"}<ArrowRight className="h-4 w-4" /></Link></div><div className="relative min-h-64 bg-[linear-gradient(145deg,#e8f6ff,#effdf8)]"><img src="https://i.postimg.cc/fTtNN9PM/Automatizacao-de-instrumento.png" alt="Ilustração institucional da automação do instrumento" className="absolute inset-0 h-full w-full object-contain p-6" /></div></div></article>

      <aside className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#003b70]"><Building2 className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#0b8f58]">Seu cadastro</p><h3 className="text-xl font-black text-[#003b70]">Identidade institucional</h3></div></div><dl className="mt-6 space-y-4 text-sm"><div><dt className="text-slate-400">Nome</dt><dd className="mt-1 font-black text-slate-800">{person.fullName}</dd></div><div><dt className="text-slate-400">Cargo</dt><dd className="mt-1 font-black text-slate-800">{person.jobTitle ?? "Não informado"}</dd></div><div><dt className="text-slate-400">Unidade</dt><dd className="mt-1 font-black text-slate-800">{unit}</dd></div>{coordination && <div><dt className="text-slate-400">Coordenação</dt><dd className="mt-1 font-black text-slate-800">{coordination}</dd></div>}</dl><Link href="/perfil" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#0b8f58]">Abrir perfil <ArrowRight className="h-4 w-4" /></Link></aside>
    </section>
  </PlatformShell>;
}
