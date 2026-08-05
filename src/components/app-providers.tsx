"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { PlatformInteractionLayer } from "@/components/platform-interaction-layer";
import { PlatformThemeToggle } from "@/components/platform-theme-toggle";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformInteractionLayer>{children}</PlatformInteractionLayer>
      <div data-print-hidden="true" className="fixed bottom-4 right-4 z-[80]">
        <PlatformThemeToggle />
      </div>
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
