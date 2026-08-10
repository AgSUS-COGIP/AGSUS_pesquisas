"use client";

import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Breadcrumbs, PageActions } from "@/components/ui/page-navigation";
import { PageHeader, Surface } from "@/components/ui/surface";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export default function ResultsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.RESULTS);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="resultados"
      restrictedTitle="Resultados restritos"
      restrictedDescription="O módulo Resultados está disponível para a administração da plataforma."
    />;
  }

  return (
    <PlatformShell
      user={guard.user}
      eyebrow="Devolutivas e publicações"
      title="Meus resultados"
    >
      <Breadcrumbs items={[{ label: "Visão geral", href: "/area" }, { label: "Resultados" }]} />
      <PageHeader
        eyebrow="Resultados individuais"
        title="Publicações disponíveis"
        description="Consulte devolutivas e planos de desenvolvimento liberados pela administração de cada ciclo."
        actions={
          <PageActions>
            <Link href="/pesquisas" className={buttonVariants({ variant: "secondary" })}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Ver avaliações
            </Link>
          </PageActions>
        }
      />

      <Surface className="mt-6 p-5 sm:p-6">
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
          title="Nenhum resultado publicado"
          description="Seu histórico de participação está preservado. Esta área será atualizada quando a administração liberar resultados do CDDI ou de outras avaliações."
        />
      </Surface>
    </PlatformShell>
  );
}
