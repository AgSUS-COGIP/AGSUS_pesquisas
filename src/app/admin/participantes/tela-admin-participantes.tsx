"use client";

import Link from "next/link";
import { AdminParticipantBulkSelector } from "@/components/admin-participant-bulk-selector";
import { AdminParticipantManagement } from "@/components/admin-participant-management";
import { PeopleBaseSummaryCard } from "@/components/people-base-summary";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export default function AdminParticipantsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_PARTICIPANTS);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="participantes"
      unidentifiedTitle="Não foi possível abrir participantes"
      restrictedTitle="Gestão de participantes restrita"
      restrictedDescription="Seu perfil não possui permissão para gerenciar participantes e elegibilidade."
    />;
  }

  return <PlatformShell user={guard.user} eyebrow="Público e elegibilidade" title="Participantes" actions={<Link href="/admin/importacao" className="hidden rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#075ea8] md:inline-flex">Atualizar base</Link>}>
    <section className="mb-6 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--brand-secondary)]">Gestão por avaliação</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-black text-brand-primary">Defina quem pode responder</h2><p className="mt-3 max-w-3xl leading-7 text-[var(--text-secondary)]">A base institucional contém as pessoas disponíveis. Selecione uma avaliação e vincule somente quem deverá respondê-la, individualmente ou em lote, com controle de bloqueios, reativações e exclusões.</p></div><Link href="/admin" className="inline-flex shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-black text-brand-primary transition hover:bg-[var(--surface-card)]">Voltar à central</Link></div>
    </section>
    <PeopleBaseSummaryCard />
    <div className="mt-5"><AdminParticipantBulkSelector /></div>
    <div className="mt-5"><AdminParticipantManagement /></div>
  </PlatformShell>;
}
