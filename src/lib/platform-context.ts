"use client";

import { useEffect, useState } from "react";
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
  };
  participant?: { status: string; accessProfile: string | null; completedAt: string | null } | null;
  application?: { id?: string; code?: string; name?: string; status: string; opensAt: string | null; closesAt: string | null };
  isLeader?: boolean;
  roles?: string[];
  modules?: string[];
};

const ADMIN_MODULES = ["HOME", "SURVEYS", "DASHBOARDS", "TEAM", "RESULTS", "ADMIN_SURVEYS", "ADMIN_PARTICIPANTS", "ADMIN_TEAMS", "ADMIN_ACCESS", "ADMIN_IMPORT"];
const CONTEXT_TTL = 2 * 60_000;
let cachedContext: PlatformContext | null = null;
let cachedAt = 0;
let pendingContext: Promise<PlatformContext> | null = null;

export function deriveModules(context: PlatformContext) {
  const roles = context.roles ?? [];
  if (roles.includes("ADMINISTRATOR")) return ADMIN_MODULES;
  if (context.modules?.length) return context.modules;
  if (roles.includes("TECHNICAL_TEAM")) return ADMIN_MODULES;
  if (roles.includes("SURVEY_MANAGER")) return ADMIN_MODULES.filter((item) => item !== "ADMIN_ACCESS");
  const modules = ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];
  if (context.isLeader || roles.includes("LEADER")) modules.push("TEAM");
  return modules;
}

export function profileLabel(context: PlatformContext) {
  const roles = context.roles ?? [];
  if (roles.includes("ADMINISTRATOR")) return "Administrador da Plataforma";
  if (roles.includes("TECHNICAL_TEAM")) return "Equipe Técnica";
  if (roles.includes("SURVEY_MANAGER")) return "Gestor de pesquisa";
  if (context.isLeader || roles.includes("LEADER")) return "Liderança";
  return "Participante";
}

async function fetchPlatformContext() {
  if (cachedContext && Date.now() - cachedAt < CONTEXT_TTL) return cachedContext;
  if (pendingContext) return pendingContext;

  pendingContext = (async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("AUTH_REQUIRED");

    const { data, error: contextError } = await supabase.rpc("get_my_platform_context");
    let resolved: PlatformContext;
    if (!contextError && data && (data as PlatformContext).status === "OK") {
      resolved = data as PlatformContext;
    } else {
      const fallback = await supabase.rpc("get_my_cddi_context");
      if (fallback.error) throw fallback.error;
      resolved = fallback.data as PlatformContext;
      if (!resolved || resolved.status !== "OK") throw new Error(resolved?.message ?? "Não foi possível carregar o cadastro institucional.");
    }
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
