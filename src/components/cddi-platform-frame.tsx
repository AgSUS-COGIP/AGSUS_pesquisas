"use client";

import type { ReactNode } from "react";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PlatformShell } from "@/components/platform-shell";
import { usePlatformGuard } from "@/lib/platform-context";

/**
 * Moldura das telas do CDDI.
 *
 * Sem módulo exigido: a jornada é aberta a qualquer pessoa identificada — quem
 * pode responder é decidido pela participação no ciclo, não pelo perfil.
 *
 * Responder é uma jornada de foco: usa o `PlatformShell` em modo `focus` (sem
 * barra lateral) para que nada compita com o formulário, mantendo o cabeçalho
 * institucional, a foto e a rolagem já testados da casca.
 */
export function CddiPlatformFrame({ children, title }: { children: ReactNode; title: string }) {
  const guard = usePlatformGuard();

  if (guard.state !== "granted") return <PlatformGuardState guard={guard} title={title} />;

  return <PlatformShell user={guard.user} focus exitHref="/area" eyebrow="Ciclo institucional" title={title}>{children}</PlatformShell>;
}
