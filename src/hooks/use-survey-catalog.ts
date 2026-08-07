"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SurveyCatalogItem } from "@/lib/survey-catalog";

export const surveyCatalogQueryKey = ["surveys", "my-catalog"] as const;

async function fetchSurveyCatalog() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("list_my_survey_catalog");
  if (error) throw error;
  return Array.isArray(data) ? data as SurveyCatalogItem[] : [];
}

export function useSurveyCatalog(enabled: boolean) {
  return useQuery({
    queryKey: surveyCatalogQueryKey,
    queryFn: fetchSurveyCatalog,
    enabled,
    staleTime: 60_000,
  });
}
