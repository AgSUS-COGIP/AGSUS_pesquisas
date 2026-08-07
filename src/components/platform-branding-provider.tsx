"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_PLATFORM_BRANDING, normalizePlatformBranding, type PlatformBranding } from "@/lib/platform-branding";

export const platformBrandingQueryKey = ["platform", "branding"] as const;
const PLATFORM_BRANDING_CACHE_KEY = "agsus-platform-branding-v1";

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
  const [cachedBranding, setCachedBranding] = useState<PlatformBranding | null>(null);
  const query = useQuery({
    queryKey: platformBrandingQueryKey,
    queryFn: fetchPlatformBranding,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const branding = query.data ?? cachedBranding ?? DEFAULT_PLATFORM_BRANDING;
  const brandingResolved = !isBrowserSupabaseConfigured() || Boolean(query.data ?? cachedBranding);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(PLATFORM_BRANDING_CACHE_KEY);
      if (cached) setCachedBranding(normalizePlatformBranding(JSON.parse(cached)));
    } catch {
      window.localStorage.removeItem(PLATFORM_BRANDING_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!query.data) return;
    setCachedBranding(query.data);
    window.localStorage.setItem(PLATFORM_BRANDING_CACHE_KEY, JSON.stringify(query.data));
  }, [query.data]);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-solid", branding.primaryColor);
    return () => { document.documentElement.style.removeProperty("--brand-solid"); };
  }, [branding.primaryColor]);

  return (
    <PlatformBrandingContext.Provider value={{ branding, loading: !brandingResolved }}>
      {children}
    </PlatformBrandingContext.Provider>
  );
}

export function usePlatformBranding() {
  return useContext(PlatformBrandingContext);
}
