import type { Metadata } from "next";
import { CddiScrollBoundary } from "@/components/cddi-scroll-boundary";
import { DEFAULT_PLATFORM_BRANDING, platformBrandingTitle } from "@/lib/platform-branding";
import "./cddi-route.css";

export const metadata: Metadata = {
  title: `CDDI 2026 | ${platformBrandingTitle(DEFAULT_PLATFORM_BRANDING)}`,
  description: "Ciclo de Devolutivas e Desenvolvimento Individual da AgSUS.",
};

export default function CddiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CddiScrollBoundary>{children}</CddiScrollBoundary>;
}
