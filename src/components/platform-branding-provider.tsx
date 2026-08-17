"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { obterMarcaDaPlataforma } from "@/lib/api/cliente-pessoas";
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

/**
 * Busca a marca pela rota REST.
 *
 * Este provider é montado em **toda** página, inclusive na tela de acesso, que
 * é anônima. Lá a chamada falha — o middleware devolve 401 antes de a rota
 * executar —, e é por isso que `brandingResolved` considera `query.isFetched`:
 * sem sessão a marca não vem, e o provider precisa entregar o padrão em vez de
 * ficar preso em carregando. O comportamento é o mesmo de quando a chamada era
 * `supabase.rpc()` direto e falhava por falta de sessão; o que mudou é que
 * agora a recusa chega como status, e não como mensagem solta.
 *
 * A tela pública `/acesso` não depende disto: ela é Server Component e resolve
 * a marca por cliente próprio, antes de existir sessão.
 */
async function fetchPlatformBranding() {
  if (!isBrowserSupabaseConfigured()) return DEFAULT_PLATFORM_BRANDING;
  return normalizePlatformBranding(await obterMarcaDaPlataforma());
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
  // A marca também está "resolvida" quando a busca termina sem dados — caso da
  // página pública de acesso, onde a RPC falha por falta de sessão. Sem o
  // `query.isFetched`, o provider ficava preso em carregando e o logotipo
  // aparecia como um quadrado cinza vazio para quem ainda não entrou.
  const brandingResolved = !isBrowserSupabaseConfigured() || Boolean(query.data ?? cachedBranding) || query.isFetched;

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

  useEffect(() => {
    if (!brandingResolved || !branding.logoPath) return;

    const favicon = document.createElement("link");
    favicon.id = "platform-branding-favicon";
    favicon.rel = "icon";

    const logoUrl = new URL(branding.logoUrl, window.location.origin);
    if (branding.updatedAt) logoUrl.searchParams.set("v", branding.updatedAt);
    favicon.href = logoUrl.toString();
    document.head.appendChild(favicon);

    return () => { favicon.remove(); };
  }, [branding.logoPath, branding.logoUrl, branding.updatedAt, brandingResolved]);

  return (
    <PlatformBrandingContext.Provider value={{ branding, loading: !brandingResolved }}>
      {children}
    </PlatformBrandingContext.Provider>
  );
}

export function usePlatformBranding() {
  return useContext(PlatformBrandingContext);
}
