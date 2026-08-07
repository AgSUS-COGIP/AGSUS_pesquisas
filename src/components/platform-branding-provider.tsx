"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_PLATFORM_BRANDING, normalizePlatformBranding, type PlatformBranding } from "@/lib/platform-branding";

export const platformBrandingQueryKey = ["platform", "branding"] as const;

type PlatformBrandingContextValue = {
  branding: PlatformBranding;
  loading: boolean;
};

const PlatformBrandingContext = createContext<PlatformBrandingContextValue>({
  branding: DEFAULT_PLATFORM_BRANDING,
  loading: false,
});

async function fetchPlatformBranding() {
  if (!isBrowserSupabaseConfigured()) return DEFAULT_PLATFORM_BRANDING;
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_marca_plataforma");
  if (error) throw error;
  return normalizePlatformBranding(data);
}

export function PlatformBrandingProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: platformBrandingQueryKey,
    queryFn: fetchPlatformBranding,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const branding = query.data ?? DEFAULT_PLATFORM_BRANDING;

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-solid", branding.primaryColor);
    return () => { document.documentElement.style.removeProperty("--brand-solid"); };
  }, [branding.primaryColor]);

  return (
    <PlatformBrandingContext.Provider value={{ branding, loading: query.isLoading }}>
      {children}
    </PlatformBrandingContext.Provider>
  );
}

export function usePlatformBranding() {
  return useContext(PlatformBrandingContext);
}
