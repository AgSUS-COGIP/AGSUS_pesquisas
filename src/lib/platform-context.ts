"use client";

import { useEffect, useState } from "react";
import { resolvePlatformModules } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
  isLeader?: boolean;
  roles?: string[];
  modules?: string[];
  canManageSurveys?: boolean;
};

type AccessResolution = {
  status?: string;
  message?: string;
};

const CONTEXT_TTL = 2 * 60_000;
let cachedContext: PlatformContext | null = null;
let cachedAt = 0;
let pendingContext: Promise<PlatformContext> | null = null;

export function deriveModules(context: PlatformContext) {
  return resolvePlatformModules({
    roles: context.roles,
    explicitModules: context.modules,
    isLeader: context.isLeader,
  });
}

export function profileLabel(context: PlatformContext) {
  const roles = context.roles ?? [];
  if (roles.includes("ADMINISTRATOR")) return "Administrador da Plataforma";
  if (roles.includes("TECHNICAL_TEAM")) return "Equipe Técnica";
  if (roles.includes("SURVEY_MANAGER")) return "Gestor de pesquisa";
  if (context.isLeader || roles.includes("LEADER")) return "Liderança";
  return "Participante";
}

async function loadContextFromDatabase() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("get_my_platform_context");
  if (error) throw new Error(`Falha ao carregar permissões da plataforma: ${error.message}`);
  return data as PlatformContext | null;
}

async function syncGoogleAvatar() {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("sync_my_google_avatar");
  if (error && !error.message.includes("AUTH_REQUIRED")) {
    console.warn("Não foi possível sincronizar a foto da conta Google.", error.message);
  }
}

async function provisionInstitutionalAccess() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("resolve_authenticated_person", {
    target_employee_number: null,
  });
  if (error) throw new Error(`Falha ao registrar o acesso institucional: ${error.message}`);

  const resolution = data as AccessResolution | null;
  if (resolution?.status !== "OK") {
    throw new Error(resolution?.message ?? "Não foi possível registrar o acesso institucional.");
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

export function invalidatePlatformContext() {
  cachedContext = null;
  cachedAt = 0;
}

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
