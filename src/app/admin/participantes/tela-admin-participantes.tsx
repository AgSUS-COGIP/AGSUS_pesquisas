"use client";

import { AdminParticipantLinker } from "@/components/admin-participant-linker";
import { PeopleBaseSummaryCard } from "@/components/people-base-summary";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
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
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <Breadcrumbs items={[{ label: "Administração", href: "/admin" }, { label: "Participantes" }]} />

      <PageHeader
        eyebrow="Gestão por avaliação"
        title="Defina quem pode responder"
        description="A base institucional reúne as pessoas disponíveis. Escolha a avaliação, busque quem deve respondê-la e vincule. Para conferir o público já definido, abra a visualização completa ao fim da página."
      />

      <PeopleBaseSummaryCard />
      <AdminParticipantLinker />
    </div>
  </PlatformShell>;
}
