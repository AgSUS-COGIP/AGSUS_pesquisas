"use client";

import Link from "next/link";
import { Info, UploadCloud } from "lucide-react";
import { AdminParticipantBulkSelector } from "@/components/admin-participant-bulk-selector";
import { AdminParticipantManagement } from "@/components/admin-participant-management";
import { PeopleBaseSummaryCard } from "@/components/people-base-summary";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/page-navigation";
import { PageHeader } from "@/components/ui/surface";
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

  return <PlatformShell
    user={guard.user}
    eyebrow="Público e elegibilidade"
    title="Participantes"
    actions={<Link href="/admin/importacao" title="Atualizar a base institucional por planilha" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"><UploadCloud className="h-4 w-4" aria-hidden="true" />Atualizar base</Link>}
  >
    <div className="mx-auto max-w-6xl space-y-6">
      <Breadcrumbs items={[{ label: "Administração", href: "/admin" }, { label: "Participantes" }]} />

      <PageHeader
        eyebrow="Gestão por avaliação"
        title="Defina quem pode responder"
        description="A base institucional reúne as pessoas disponíveis. Selecione uma avaliação e vincule somente quem deve respondê-la, individualmente ou em lote."
        actions={<Badge variant="info"><Info className="h-3.5 w-3.5" aria-hidden="true" />Importar a base não vincula ninguém a avaliações</Badge>}
      />

      <PeopleBaseSummaryCard />
      <AdminParticipantBulkSelector />
      <AdminParticipantManagement />
    </div>
  </PlatformShell>;
}
