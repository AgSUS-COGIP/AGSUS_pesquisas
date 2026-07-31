"use client";

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
  if (!context?.person || context.status !== "OK") return <main className="flex min-h-screen items-center justify-center bg-[#f2f6fa] px-6"><section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Acesso institucional</p><h1 className="mt-2 text-3xl font-black text-[#003b70]">Não foi possível abrir seu painel</h1><p className="mt-4 leading-7 text-slate-600">{error || context?.message || "Cadastro institucional não localizado."}</p><Link href="/acesso" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao acesso</Link></section></main>;

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

  return <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
    <section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_85%_20%,rgba(41,199,154,.35),transparent_28%),linear-gradient(120deg,#002f59,#075ea8)] p-6 text-white shadow-xl sm:p-8">
      <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full border-[42px] border-white/5" />
      <div className="relative grid gap-8 xl:grid-cols-[1.4fr_.8fr] xl:items-end">
        <div><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-emerald-200">{profileLabel(context)} · Sessão institucional</span><p className="mt-6 text-sm font-bold text-blue-100">{greeting()},</p><h2 className="mt-1 text-3xl font-black sm:text-4xl">{firstName}</h2><p className="mt-3 max-w-2xl text-base leading-7 text-blue-100">Acompanhe suas pesquisas, avaliações e resultados em um único ambiente seguro da AgSUS.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/pesquisas" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-[#003b70] shadow-lg">Abrir minhas pesquisas</Link>{isLeader && <Link href="/equipe" className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white">Ver minha equipe</Link>}{isAdmin && <Link href="/admin" className="rounded-xl border border-emerald-300/40 bg-emerald-300/15 px-5 py-3 text-sm font-black text-emerald-50">Central administrativa</Link>}</div></div>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><span className="text-xs font-bold text-blue-100">Pesquisa atual</span><strong className="mt-2 block text-2xl">CDDI 2026</strong><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${completed ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}>{statusLabel}</span></div><div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><span className="text-xs font-bold text-blue-100">Módulos liberados</span><strong className="mt-2 block text-4xl">{modules.length}</strong><span className="mt-3 block text-xs text-blue-100">conforme seu perfil</span></div></div>
      </div>
    </section>

    {closed && <div className="mt-5 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><span className="text-xl">!</span><div><strong>O período do CDDI 2026 foi encerrado.</strong><p className="mt-1 text-sm leading-6 text-amber-800">O formulário permanece disponível em modo de consulta conforme suas permissões.</p></div></div>}

    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Situação do ciclo", statusLabel, completed ? "Entrega registrada" : "Consulte o formulário", "/pesquisas"],
        ["Perfil de acesso", profileLabel(context), person.employeeNumber ? `Matrícula ${person.employeeNumber}` : "Cadastro institucional", "/perfil"],
        ["Unidade", unit, coordination ?? "Estrutura organizacional", "/perfil"],
        [isLeader ? "Responsabilidade" : "Resultados", isLeader ? "Avaliação de equipe" : "Resultado individual", isLeader ? "Acompanhe suas pendências" : "Consulte quando liberado", isLeader ? "/equipe" : "/resultados"],
      ].map(([label, value, detail, href]) => <Link href={href} key={label} className="group rounded-3xl border border-[#d7e5f2] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><strong className="mt-3 block line-clamp-2 text-xl text-[#003b70]">{value}</strong><span className="mt-3 flex items-center justify-between text-sm text-slate-500">{detail}<b className="text-[#0b8f58] transition group-hover:translate-x-1">→</b></span></Link>)}
    </section>

    <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <article className="rounded-[2rem] border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Jornada atual</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Ciclo de Devolutivas e Desenvolvimento Individual</h3></div><span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-800">CDDI 2026</span></div><p className="mt-4 max-w-3xl leading-7 text-slate-600">Avaliação estruturada por competências, com autoavaliação, avaliação da liderança, devolutiva e ações de desenvolvimento.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Competências</span><strong className="mt-1 block text-2xl text-[#003b70]">12</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Perguntas</span><strong className="mt-1 block text-2xl text-[#003b70]">52</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Etapas guiadas</span><strong className="mt-1 block text-2xl text-[#003b70]">13</strong></div></div><Link href="/cddi" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">{closed ? "Consultar formulário" : completed ? "Revisar envio" : "Continuar avaliação"}</Link></article>
      <aside className="rounded-[2rem] border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-7"><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Seu cadastro</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Identidade institucional</h3><dl className="mt-6 space-y-4 text-sm"><div><dt className="text-slate-400">Nome</dt><dd className="mt-1 font-black text-slate-800">{person.fullName}</dd></div><div><dt className="text-slate-400">Cargo</dt><dd className="mt-1 font-black text-slate-800">{person.jobTitle ?? "Não informado"}</dd></div><div><dt className="text-slate-400">Unidade</dt><dd className="mt-1 font-black text-slate-800">{unit}</dd></div><div><dt className="text-slate-400">E-mail</dt><dd className="mt-1 break-all font-black text-slate-800">{person.institutionalEmail ?? "Não informado"}</dd></div></dl><Link href="/perfil" className="mt-6 inline-flex text-sm font-black text-[#0b8f58]">Abrir meu perfil →</Link></aside>
    </section>
  </PlatformShell>;
}
