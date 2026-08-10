"use client";

import { FullPageState } from "@/components/full-page-state";
import { PlatformSkeleton } from "@/components/platform-shell";
import type { PlatformGuardDecision } from "@/lib/platform-guard";

type PlatformGuardStateProps = {
  /** Decisão de `usePlatformGuard()`. Renderizar só quando `state !== "granted"`. */
  guard: PlatformGuardDecision;
  /** Nome da tela, usado no skeleton: "Carregando {title}". */
  title: string;
  /**
   * Título e descrição da tela de acesso restrito, específicos de cada módulo.
   *
   * Opcionais porque uma guarda sem `requiredModule` nunca chega a `restricted`
   * — é o caso das telas abertas a qualquer pessoa identificada e daquelas que
   * apresentam a restrição dentro da casca, com a navegação preservada.
   */
  restrictedTitle?: string;
  restrictedDescription?: string;
  /** Título do erro de identidade; o texto vem do contexto (`guard.message`). */
  unidentifiedTitle?: string;
};

/**
 * Renderiza os estados de guarda que impedem a página de montar.
 *
 * Concentra o que antes cada tela reimplementava — e reimplementava de formas
 * diferentes: parte usava `FullPageState`, parte um `<main>` vermelho sem
 * navegação de saída. Aqui todo desfecho negado é uma tela institucional com
 * caminho de volta.
 *
 * `granted` não é responsabilidade deste componente: devolve `null` para que um
 * uso equivocado não apague o conteúdo da página.
 */
export function PlatformGuardState({
  guard,
  title,
  restrictedTitle,
  restrictedDescription,
  unidentifiedTitle = "Acesso não identificado",
}: PlatformGuardStateProps) {
  if (guard.state === "loading") return <PlatformSkeleton title={`Carregando ${title}`} />;

  if (guard.state === "unidentified") {
    return (
      <FullPageState
        title={unidentifiedTitle}
        description={guard.message}
        actionHref="/acesso"
        actionLabel="Voltar ao acesso"
      />
    );
  }

  if (guard.state === "restricted") {
    return (
      <FullPageState
        tone="restricted"
        title={restrictedTitle || "Acesso restrito"}
        description={restrictedDescription || "Seu perfil não possui permissão para acessar este módulo."}
      />
    );
  }

  return null;
}
