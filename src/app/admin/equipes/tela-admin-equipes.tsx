"use client";

import { ShieldAlert } from "lucide-react";
import { AdminPeopleTeamsManagement } from "@/components/admin-people-teams-management";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/page-navigation";
import { PageHeader } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export default function AdminTeamsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_TEAMS);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="gestão institucional"
      unidentifiedTitle="Não foi possível abrir equipes"
      restrictedTitle="Gestão institucional restrita"
      restrictedDescription="A edição de dados funcionais e vínculos é exclusiva do Superadmin."
    />;
  }

  return <PlatformShell
    user={guard.user}
    eyebrow="Estrutura organizacional"
    title="Pessoas, equipes e lideranças"
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <Breadcrumbs items={[{ label: "Administração", href: "/admin" }, { label: "Equipes e lideranças" }]} />

      <PageHeader
        eyebrow="Administração da plataforma"
        title="Mantenha a estrutura institucional correta"
        description="Consulte pessoas, corrija dados funcionais e defina vínculos de liderança por ciclo."
        actions={<Badge variant="warning"><ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />Matrícula é imutável · toda mudança exige justificativa</Badge>}
      />

      <AdminPeopleTeamsManagement />
    </div>
  </PlatformShell>;
}
