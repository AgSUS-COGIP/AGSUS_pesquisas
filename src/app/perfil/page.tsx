"use client";

import Link from "next/link";
import { BadgeCheck, Building2, KeyRound, Mail, MapPin, UserRound } from "lucide-react";
import { AvatarIdentityPicker } from "@/components/avatar-identity-picker";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

function metadataText(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export default function ProfilePage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando seu perfil" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Não foi possível identificar seu acesso."}</main>;

  const person = context.person;
  const modules = deriveModules(context);
  const avatarUrl = metadataText(person.metadata, "avatar_url");
  const avatarSource = metadataText(person.metadata, "avatar_source");
  const googleAvatarUrl = metadataText(person.metadata, "google_avatar_url");
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter;
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const directorate = metadataText(person.metadata, "directorate", "diretoria");
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), avatarUrl, roles: context.roles, modules };

  const fields = [
    { label: "Matrícula", value: person.employeeNumber, icon: KeyRound },
    { label: "E-mail institucional", value: person.institutionalEmail ?? "Não informado", icon: Mail },
    { label: "Cargo", value: person.jobTitle ?? "Não informado", icon: UserRound },
    { label: "Diretoria", value: directorate ?? "Não informada", icon: Building2 },
    { label: "Unidade", value: unit ?? "Não informada", icon: Building2 },
    { label: "Coordenação", value: coordination ?? "Não informada", icon: Building2 },
    { label: "Local de trabalho", value: person.workplace ?? "Não informado", icon: MapPin },
  ];

  return <PlatformShell user={user} eyebrow="Conta" title="Perfil">
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="page-intro">
        <div>
          <p className="section-eyebrow">Identidade institucional</p>
          <h2 className="page-title">Seu perfil na plataforma</h2>
          <p className="page-description">Gerencie sua imagem de perfil e consulte os dados sincronizados do cadastro institucional.</p>
        </div>
        <span className="status-badge"><BadgeCheck className="h-4 w-4" />Cadastro validado</span>
      </section>

      <AvatarIdentityPicker personName={person.fullName} currentUrl={avatarUrl} currentSource={avatarSource} googleUrl={googleAvatarUrl} />

      <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <article className="surface-card p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="section-eyebrow">Dados funcionais</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Informações sincronizadas</h3></div><span className="text-xs font-medium text-slate-500">Somente leitura</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {fields.map(({ label, value, icon: Icon }) => <div key={label} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div></div>)}
          </div>
        </article>

        <aside className="surface-card p-6">
          <p className="section-eyebrow">Acesso</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Perfil e permissões</h3>
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-medium text-blue-700">Perfil principal</p><p className="mt-1 font-semibold text-blue-950">{profileLabel(context)}</p></div>
          <div className="mt-4 flex flex-wrap gap-2">{(context.roles ?? []).map((role) => <span key={role} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{role}</span>)}</div>
          <div className="mt-6 space-y-2"><Link href="/area" className="primary-button w-full justify-center">Voltar à visão geral</Link>{modules.some((module) => module.startsWith("ADMIN_")) && <Link href="/admin" className="secondary-button w-full justify-center">Abrir administração</Link>}</div>
        </aside>
      </section>
    </div>
  </PlatformShell>;
}
