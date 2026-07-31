"use client";

import Link from "next/link";
import { Camera, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AvatarStudio } from "@/components/avatar-studio";
import { AvatarUploader } from "@/components/avatar-uploader";
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

  const fields = [
    ["Nome completo", person.fullName],
    ["Matrícula", person.employeeNumber],
    ["E-mail institucional", person.institutionalEmail ?? "Não informado"],
    ["Cargo", person.jobTitle ?? "Não informado"],
    ["Diretoria", directorate ?? "Não informada"],
    ["Unidade", unit ?? "Não informada"],
    ["Coordenação", coordination ?? "Não informada"],
    ["Local de trabalho", person.workplace ?? "Não informado"],
  ];

  return (
    <PlatformShell user={user} eyebrow="Identidade digital" title="Meu perfil">
      <section className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(115deg,#ffffff_0%,#f7fbff_55%,#eef9f5_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#003b70] text-white shadow-lg"><Sparkles className="h-7 w-7" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Sua presença na plataforma</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Escolha como você será representado</h2>
              <p className="mt-2 max-w-3xl leading-7 text-slate-600">Crie um personagem próprio ou utilize uma foto institucional. O avatar escolhido será exibido no cabeçalho, menu, perfil e espaços colaborativos.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800"><ShieldCheck className="h-4 w-4" /> Identidade validada</span>
        </div>
      </section>

      <AvatarStudio personName={person.fullName} initialUrl={avatarUrl} />

      <section className="mt-6 grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
        <aside className="rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(0,168,214,.35),transparent_35%),linear-gradient(145deg,#003b70,#075ea8)] p-7 text-center text-white shadow-xl">
          <div className="mb-5 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-100"><Camera className="h-4 w-4" /> Alternativa com foto</div>
          <AvatarUploader personName={person.fullName} initialUrl={avatarUrl} initials={initials(person.fullName)} />
          <h2 className="mt-7 text-2xl font-black">{person.fullName}</h2>
          <p className="mt-2 text-blue-100">{person.jobTitle ?? "Cargo não informado"}</p>
          <span className="mt-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-emerald-200">{profileLabel(context)}</span>
        </aside>

        <div className="space-y-6">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#003b70]"><UserRound className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Cadastro institucional</p><h3 className="mt-1 text-2xl font-black text-slate-950">Dados da pessoa</h3></div></div>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">Dados sincronizados</span>
            </div>
            <dl className="mt-7 grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-blue-100 hover:bg-blue-50/40"><dt className="text-[11px] font-black uppercase tracking-[.12em] text-slate-400">{label}</dt><dd className="mt-2 break-words font-black text-slate-800">{value}</dd></div>)}</dl>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Autorizações</p><h3 className="mt-1 text-2xl font-black text-slate-950">Papéis e módulos liberados</h3></div></div>
            <div className="mt-5 flex flex-wrap gap-2">{(context.roles?.length ? context.roles : [profileLabel(context)]).map((role) => <span key={role} className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-800">{role === "TECHNICAL_TEAM" ? "Equipe Técnica" : role}</span>)}</div>
            <div className="mt-4 flex flex-wrap gap-2">{modules.map((module) => <span key={module} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{module}</span>)}</div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/area" className="inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white transition hover:bg-[#075ea8]">Voltar à visão geral</Link>
              {modules.some((module) => module.startsWith("ADMIN_")) && <Link href="/admin" className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-black text-[#003b70] transition hover:bg-blue-100">Abrir Equipe Técnica</Link>}
            </div>
          </article>
        </div>
      </section>
    </PlatformShell>
  );
}
