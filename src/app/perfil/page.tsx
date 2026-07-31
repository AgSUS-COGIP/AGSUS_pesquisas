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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

export default function ProfilePage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando perfil" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const person = context.person;
  const modules = deriveModules(context);
  const avatarUrl = metadataText(person.metadata, "avatar_url", "avatarUrl", "picture", "photo_url");
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter;
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const directorate = metadataText(person.metadata, "directorate", "diretoria");
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), avatarUrl, roles: context.roles, modules };

  return <PlatformShell user={user} eyebrow="Identidade e acesso" title="Meu perfil">
    <section className="grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
      <aside className="rounded-[2rem] bg-[linear-gradient(145deg,#003b70,#075ea8)] p-7 text-center text-white shadow-xl">
        {avatarUrl ? <img src={avatarUrl} alt={`Foto de ${person.fullName}`} className="mx-auto h-32 w-32 rounded-[2rem] object-cover ring-4 ring-white/20" /> : <div className="mx-auto grid h-32 w-32 place-items-center rounded-[2rem] bg-white text-4xl font-black text-[#003b70] shadow-xl">{initials(person.fullName)}</div>}
        <h2 className="mt-6 text-2xl font-black">{person.fullName}</h2><p className="mt-2 text-blue-100">{person.jobTitle ?? "Cargo não informado"}</p><span className="mt-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-emerald-200">{profileLabel(context)}</span>
        <p className="mt-6 text-sm leading-6 text-blue-100">A foto é obtida da identidade autenticada quando disponível. Na ausência dela, o sistema apresenta um avatar institucional com suas iniciais.</p>
      </aside>
      <div className="space-y-6"><article className="rounded-[2rem] border border-[#d7e5f2] bg-white p-7 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Cadastro institucional</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Dados da pessoa</h3></div><span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">Identidade validada</span></div><dl className="mt-7 grid gap-5 sm:grid-cols-2">{[["Nome completo",person.fullName],["Matrícula",person.employeeNumber],["E-mail institucional",person.institutionalEmail ?? "Não informado"],["Cargo",person.jobTitle ?? "Não informado"],["Diretoria",directorate ?? "Não informada"],["Unidade",unit ?? "Não informada"],["Coordenação",coordination ?? "Não informada"],["Local de trabalho",person.workplace ?? "Não informado"]].map(([label,value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-[.1em] text-slate-400">{label}</dt><dd className="mt-2 break-words font-black text-slate-800">{value}</dd></div>)}</dl></article>
      <article className="rounded-[2rem] border border-[#d7e5f2] bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Autorizações</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Papéis e módulos liberados</h3><div className="mt-5 flex flex-wrap gap-2">{(context.roles?.length ? context.roles : [profileLabel(context)]).map((role) => <span key={role} className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-800">{role}</span>)}</div><div className="mt-4 flex flex-wrap gap-2">{modules.map((module) => <span key={module} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{module}</span>)}</div><Link href="/area" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar à visão geral</Link></article></div>
    </section>
  </PlatformShell>;
}
