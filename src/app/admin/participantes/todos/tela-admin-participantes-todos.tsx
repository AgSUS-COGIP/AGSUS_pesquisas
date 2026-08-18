"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminParticipantRoster } from "@/components/admin-participant-roster";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Breadcrumbs } from "@/components/ui/page-navigation";
import { PageHeader } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export default function AdminAllParticipantsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_PARTICIPANTS);
  // A avaliação chega pela URL quando se vem do botão da aba de vínculo. Lido
  // uma vez, no cliente: `useSearchParams` exigiria um limite de Suspense que
  // nenhuma outra tela do projeto usa.
  const [avaliacaoInicial, setAvaliacaoInicial] = useState<string | undefined>(undefined);
  const [readParams, setReadParams] = useState(false);

  useEffect(() => {
    setAvaliacaoInicial(new URLSearchParams(window.location.search).get("avaliacao") ?? undefined);
    setReadParams(true);
  }, []);

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
    title="Todos os participantes"
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <Breadcrumbs items={[
        { label: "Administração", href: "/admin" },
        { label: "Participantes", href: "/admin/participantes" },
        { label: "Todos os participantes" },
      ]} />

      <PageHeader
        eyebrow="Visualização completa"
        title="Quem está vinculado a cada avaliação"
        description="Consulte, filtre por situação e ajuste o público já vinculado. Para incluir novas pessoas, volte à aba de participantes."
        actions={<Link href="/admin/participantes" className="secondary-button">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao vínculo
        </Link>}
      />

      {readParams ? <AdminParticipantRoster avaliacaoInicial={avaliacaoInicial} /> : null}
    </div>
  </PlatformShell>;
}
