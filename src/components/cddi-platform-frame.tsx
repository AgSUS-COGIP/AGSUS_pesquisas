"use client";

import type { ReactNode } from "react";
import { FullPageState } from "@/components/full-page-state";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export function CddiPlatformFrame({ children, title }: { children: ReactNode; title: string }) {
  const { context, loading, error } = usePlatformContext();

  if (loading) return <PlatformSkeleton title={`Carregando ${title}`} />;
  if (!context?.person) {
    return <FullPageState title="Acesso não identificado" description={error || "Não foi possível carregar seu cadastro institucional."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;
  }

  const person = context.person;
  const modules = deriveModules(context);
  const user = {
    fullName: person.fullName,
    institutionalEmail: person.institutionalEmail,
    employeeNumber: person.employeeNumber,
    profileLabel: profileLabel(context),
    avatarUrl: person.avatarUrl,
    roles: context.roles,
    modules,
  };

  return <PlatformShell user={user} eyebrow="Ciclo institucional" title={title}>{children}</PlatformShell>;
}
