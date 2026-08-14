"use client";

import { useEffect, useMemo, useState } from "react";
import { type PlatformModule } from "@/lib/platform-modules";
import { resolvePlatformGuard, type PlatformGuardDecision } from "@/lib/platform-guard";
// O cliente Supabase permanece aqui apenas para `auth.getUser()`: sessão é
// autenticação, não acesso a dados.
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { chamar, ErroDeApi } from "@/lib/api/requisicao";
import { errorMessageFromUnknown } from "@/lib/observability";

export type PlatformContext = {
  status: string;
  message?: string;
  person?: {
    id?: string;
    employeeNumber: string;
    fullName: string;
    institutionalEmail: string | null;
    jobTitle: string | null;
    costCenter: string | null;
    workplace: string | null;
    metadata: Record<string, unknown>;
    avatarUrl?: string | null;
  };
  participant?: { status: string; accessProfile: string | null; completedAt: string | null } | null;
  application?: { id?: string; code?: string; name?: string; status: string; opensAt: string | null; closesAt: string | null } | null;
  /**
   * Papéis vigentes da pessoa. **Única** fonte de autorização de interface:
   * `resolvePlatformGuard()` deriva daqui os módulos e o rótulo do perfil.
   */
  roles?: string[];
  canManageSurveys?: boolean;
};

type AccessResolution = {
  status?: string;
  message?: string;
};

// Cache de módulo (não de React): sobrevive à navegação no cliente, de modo que
// abrir várias telas não repete a resolução de permissões. Após alterar papel,
// módulo ou avatar, chame `invalidatePlatformContext()`.
const CONTEXT_TTL = 2 * 60_000;
let cachedContext: PlatformContext | null = null;
let cachedAt = 0;
// Requisição em voo compartilhada: várias instâncias montadas no mesmo ciclo
// (por exemplo cada PersonAvatar da página) aguardam a mesma promessa.
let pendingContext: Promise<PlatformContext> | null = null;

async function loadContextFromDatabase() {
  try {
    return await chamar<PlatformContext | null>("/api/meu/contexto");
  } catch (error) {
    if (error instanceof ErroDeApi && error.exigeAutenticacao) throw new Error("AUTH_REQUIRED");
    throw new Error(`Falha ao carregar permissões da plataforma: ${errorMessageFromUnknown(error)}`);
  }
}

// A foto é acessório: falha de sincronização não pode impedir o acesso, então o
// erro fica apenas em aviso. Sessão expirada (401) é silenciada porque o fluxo
// principal já vai tratá-la redirecionando para /acesso.
async function syncGoogleAvatar() {
  try {
    await chamar("/api/meu/avatar-google", { method: "POST" });
  } catch (error) {
    if (error instanceof ErroDeApi && error.exigeAutenticacao) return;
    console.warn("Não foi possível sincronizar a foto da conta Google.", errorMessageFromUnknown(error));
  }
}

async function provisionInstitutionalAccess() {
  try {
    // A rota já traduz `status !== "OK"` em 409 com a mensagem do banco, então
    // aqui basta deixar o erro subir.
    await chamar<AccessResolution>("/api/meu/acesso-institucional", { method: "POST" });
  } catch (error) {
    if (error instanceof ErroDeApi && error.exigeAutenticacao) throw new Error("AUTH_REQUIRED");
    throw new Error(`Falha ao registrar o acesso institucional: ${errorMessageFromUnknown(error)}`);
  }
}

async function fetchPlatformContext() {
  if (cachedContext && Date.now() - cachedAt < CONTEXT_TTL) return cachedContext;
  if (pendingContext) return pendingContext;

  pendingContext = (async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("AUTH_REQUIRED");

    await syncGoogleAvatar();
    let resolved = await loadContextFromDatabase();

    // Primeiro acesso: a conta autenticou no Google mas ainda não está ligada a
    // um registro em `people`. A RPC valida o domínio institucional, vincula por
    // e-mail quando existe cadastro prévio ou cria um cadastro mínimo.
    if (resolved?.status === "UNLINKED") {
      await provisionInstitutionalAccess();
      await syncGoogleAvatar();
      resolved = await loadContextFromDatabase();
    }

    if (!resolved) throw new Error("A plataforma não retornou o contexto institucional.");
    if (resolved.status === "AUTH_REQUIRED") throw new Error("AUTH_REQUIRED");
    if (resolved.status !== "OK") throw new Error(resolved.message ?? "Não foi possível carregar o cadastro institucional.");

    cachedContext = resolved;
    cachedAt = Date.now();
    return resolved;
  })().finally(() => { pendingContext = null; });

  return pendingContext;
}

/**
 * Descarta o contexto cacheado.
 *
 * Obrigatório após qualquer operação que altere papéis, módulos ou identidade
 * visual da própria pessoa — sem isso a casca exibe dado antigo por até 2 minutos.
 */
export function invalidatePlatformContext() {
  cachedContext = null;
  cachedAt = 0;
}

/**
 * Carrega identidade institucional e permissões da pessoa autenticada.
 *
 * Sessão ausente ou expirada redireciona para `/acesso` em vez de expor erro:
 * nenhuma tela autenticada tem o que mostrar sem contexto.
 */
export function usePlatformContext() {
  const [context, setContext] = useState<PlatformContext | null>(() => cachedContext);
  const [loading, setLoading] = useState(!cachedContext);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const resolved = await fetchPlatformContext();
        if (active) setContext(resolved);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message === "AUTH_REQUIRED") {
          window.location.replace("/acesso");
          return;
        }
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar seu acesso.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return { context, loading, error };
}

/**
 * Guarda de página: contexto institucional já traduzido em decisão de acesso.
 *
 * Substitui a sequência que cada tela repetia — carregando, identidade ausente,
 * módulo exigido e montagem do usuário da casca. A página passa a tratar quatro
 * estados explícitos e recebe `user` e `modules` prontos em `granted`.
 *
 * ```tsx
 * const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
 * if (guard.state !== "granted") return <PlatformGuardState guard={guard} … />;
 * ```
 *
 * Sem `requiredModule`, basta estar identificado — o caso de `/perfil` e da
 * moldura do CDDI, abertas a qualquer pessoa com cadastro ativo.
 */
export function usePlatformGuard(requiredModule?: PlatformModule): PlatformGuardDecision {
  const { context, loading, error } = usePlatformContext();
  return useMemo(
    () => resolvePlatformGuard({ context, loading, error, requiredModule }),
    [context, loading, error, requiredModule],
  );
}
