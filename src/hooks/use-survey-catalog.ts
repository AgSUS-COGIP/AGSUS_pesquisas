"use client";

import { useQuery } from "@tanstack/react-query";
import { listarMeuCatalogo } from "@/lib/api/cliente-runtime";

export const surveyCatalogQueryKey = ["surveys", "my-catalog"] as const;

export function useSurveyCatalog(enabled: boolean) {
  return useQuery({
    queryKey: surveyCatalogQueryKey,
    queryFn: listarMeuCatalogo,
    enabled,
    staleTime: 60_000,
  });
}
