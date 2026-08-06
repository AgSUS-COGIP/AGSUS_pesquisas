"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { PlatformInteractionLayer } from "@/components/platform-interaction-layer";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ClientErrorReporter />
      <PlatformInteractionLayer>{children}</PlatformInteractionLayer>
      <NetworkStatusBanner />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xl",
            title: "font-black text-[var(--brand-primary)]",
            description: "text-[var(--text-secondary)]",
          },
        }}
      />
    </QueryClientProvider>
  );
}
