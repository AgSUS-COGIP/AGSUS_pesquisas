"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AvatarUploader } from "@/components/avatar-uploader";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

const AvatarStudio = dynamic(() => import("@/components/avatar-studio").then((module) => module.AvatarStudio), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-3xl border border-slate-200 bg-slate-100" aria-label="Carregando estúdio de avatar" />,
});

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
  if (loading) return <PlatformSkeleton title="Carregando seu perfil" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Não foi possível identificar seu acesso."}</main>;

  const person = context.person;
  const modules = deriveModules(context);
  const avatarUrl = metadataText(person.metadata, "avatar_url", "avatarUrl", "picture", "photo_url");
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter;
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const directorate = metadataText(person.metadata, "directorate", "diretoria");
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), avatarUrl, roles: context.roles, modules };
  const fields = [["Nome completo", person.fullName], ["Matrícula", person.employeeNumber], ["E-mail institucional", person.institutionalEmail ?? "Não informado"], ["Cargo", person.jobTitle ?? "Não informado"], ["Diretoria", directorate ?? "Não informada"], ["Unidade", unit ?? "Não informada"], ["Coordenação", coordination ?? "Não informada"], ["Local de trabalho", person.workplace ?? "Não informado"]];

  return <PlatformShell user={user} eyebrow="Identidade e acesso" title="Meu perfil">
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#003b70] text-white"><Sparkles className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Representação na plataforma</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Escolha seu avatar ou utilize uma foto</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A imagem escolhida será exibida no cabeçalho, no menu, no perfil e nos espaços de equipe.</p></div></div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800"><ShieldCheck className="h-4 w-4" /> Cadastro validado</span>
      </div>
    </section>

    <AvatarStudio personName={person.fullName} initialUrl={avatarUrl} />

    <section className="mt-6 grid gap-6 xl:grid-cols-[.68fr_1.32fr]">
      <aside className="rounded-3xl bg-[linear-gradient(145deg,#003b70,#075ea8)] p-7 text-center text-white shadow-lg">
        <div className="mb-5 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-100"><Camera className="h-4 w-4" /> Usar foto</div>
        <AvatarUploader personName={person.fullName} initialUrl={avatarUrl} initials={initials(person.fullName)} />
        <h2 className="mt-6 text-xl font-black">{person.fullName}</h2>
        <p className="mt-2 text-sm text-blue-100">{person.jobTitle ?? "Cargo não informado"}</p>
        <span className="mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-emerald-200">{profileLabel(context)}</span>
      </aside>

      <div className="space-y-6">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#003b70]"><UserRound className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Cadastro institucional</p><h3 className="mt-1 text-xl font-black text-slate-950">Seus dados</h3></div></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Sincronizados</span></div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-[11px] font-black uppercase tracking-[.1em] text-slate-400">{label}</dt><dd className="mt-2 break-words font-bold text-slate-800">{value}</dd></div>)}</dl>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Autorizações</p><h3 className="mt-1 text-xl font-black text-slate-950">Papéis e módulos disponíveis</h3></div></div>
          <div className="mt-5 flex flex-wrap gap-2">{(context.roles?.length ? context.roles : [profileLabel(context)]).map((role) => <span key={role} className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-800">{role === "TECHNICAL_TEAM" ? "Equipe Técnica" : role === "ADMINISTRATOR" ? "Administrador da Plataforma" : role}</span>)}</div>
          <div className="mt-4 flex flex-wrap gap-2">{modules.map((module) => <span key={module} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{module}</span>)}</div>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/area" className="inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white transition hover:bg-[#075ea8]">Voltar à visão geral</Link>{modules.some((module) => module.startsWith("ADMIN_")) && <Link href="/admin" className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-black text-[#003b70] transition hover:bg-blue-100">Abrir administração</Link>}</div>
        </article>
      </div>
    </section>
  </PlatformShell>;
}
