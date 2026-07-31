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
  participant?: {
    status: string;
    accessProfile: string | null;
    completedAt: string | null;
  } | null;
  application?: {
    id?: string;
    code?: string;
    name?: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  };
  isLeader?: boolean;
  roles?: string[];
  modules?: string[];
};

const ADMIN_MODULES = [
  "HOME",
  "SURVEYS",
  "DASHBOARDS",
  "TEAM",
  "RESULTS",
  "ADMIN_SURVEYS",
  "ADMIN_PARTICIPANTS",
  "ADMIN_TEAMS",
  "ADMIN_ACCESS",
  "ADMIN_IMPORT",
];

export function deriveModules(context: PlatformContext) {
  if (context.modules?.length) return context.modules;
  const roles = context.roles ?? [];
  if (roles.includes("ADMINISTRATOR")) return ADMIN_MODULES;
  if (roles.includes("TECHNICAL_TEAM")) return ADMIN_MODULES;
  if (roles.includes("SURVEY_MANAGER")) return ADMIN_MODULES.filter((item) => item !== "ADMIN_ACCESS");

  const modules = ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];
  if (context.isLeader || roles.includes("LEADER")) modules.push("TEAM");
  return modules;
}

export function profileLabel(context: PlatformContext) {
  const roles = context.roles ?? [];
  if (roles.includes("ADMINISTRATOR")) return "Administrador";
  if (roles.includes("TECHNICAL_TEAM")) return "Equipe Técnica";
  if (roles.includes("SURVEY_MANAGER")) return "Gestor de pesquisa";
  if (context.isLeader || roles.includes("LEADER")) return "Liderança";
  return "Participante";
}

export function usePlatformContext() {
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.replace("/acesso");
          return;
        }

        const { data, error: contextError } = await supabase.rpc("get_my_platform_context");
        if (!contextError && data && (data as PlatformContext).status === "OK") {
          setContext(data as PlatformContext);
          return;
        }

        const fallback = await supabase.rpc("get_my_cddi_context");
        if (fallback.error) throw fallback.error;
        const fallbackContext = fallback.data as PlatformContext;
        if (!fallbackContext || fallbackContext.status !== "OK") {
          throw new Error(fallbackContext?.message ?? "Não foi possível carregar o cadastro institucional.");
        }
        setContext(fallbackContext);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar seu acesso.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return { context, loading, error };
}
