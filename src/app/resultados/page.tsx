"use client";

import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Breadcrumbs, PageActions } from "@/components/ui/page-navigation";
import { PageHeader, Surface } from "@/components/ui/surface";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function ResultsPage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando resultados" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);

  return (
    <PlatformShell
      user={{
        fullName: context.person.fullName,
        institutionalEmail: context.person.institutionalEmail,
        employeeNumber: context.person.employeeNumber,
        profileLabel: profileLabel(context),
        avatarUrl: context.person.avatarUrl,
        roles: context.roles,
        modules,
      }}
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
              Ver pesquisas
            </Link>
          </PageActions>
        }
      />

      <Surface className="mt-6 p-5 sm:p-6">
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
          title="Nenhum resultado publicado"
          description="Seu histórico de participação está preservado. Esta área será atualizada quando a administração liberar resultados do CDDI ou de outras pesquisas."
        />
      </Surface>
    </PlatformShell>
  );
}
