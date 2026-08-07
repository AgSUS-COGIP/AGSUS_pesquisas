"use client";

import Link from "next/link";
import { AdminParticipantBulkSelector } from "@/components/admin-participant-bulk-selector";
import { AdminParticipantManagement } from "@/components/admin-participant-management";
import { PeopleBaseSummaryCard } from "@/components/people-base-summary";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function AdminParticipantsPage() {
  const { context, loading, error } = usePlatformContext();

  if (loading) return <PlatformSkeleton title="Carregando participantes" />;
  if (!context?.person) return <FullPageState title="Não foi possível abrir participantes" description={error || "Seu acesso institucional não foi identificado."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;

  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_PARTICIPANTS")) {
    return <FullPageState tone="restricted" title="Gestão de participantes restrita" description="Seu perfil não possui permissão para gerenciar participantes e elegibilidade." />;
  }

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    avatarUrl: context.person.avatarUrl,
    roles: context.roles,
    modules,
  };

  return <PlatformShell user={user} eyebrow="Público e elegibilidade" title="Participantes" actions={<Link href="/admin/importacao" className="hidden rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#075ea8] md:inline-flex">Atualizar base</Link>}>
    <section className="mb-6 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--brand-secondary)]">Gestão por pesquisa</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-black text-brand-primary">Defina quem pode responder</h2><p className="mt-3 max-w-3xl leading-7 text-[var(--text-secondary)]">A base institucional contém as pessoas disponíveis. Selecione uma pesquisa e vincule somente quem deverá respondê-la, individualmente ou em lote, com controle de bloqueios, reativações e exclusões.</p></div><Link href="/admin" className="inline-flex shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-black text-brand-primary transition hover:bg-[var(--surface-card)]">Voltar à central</Link></div>
    </section>
    <PeopleBaseSummaryCard />
    <div className="mt-5"><AdminParticipantBulkSelector /></div>
    <div className="mt-5"><AdminParticipantManagement /></div>
  </PlatformShell>;
}
