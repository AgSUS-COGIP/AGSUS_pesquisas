import type { Metadata } from "next";
import { CddiScrollBoundary } from "@/components/cddi-scroll-boundary";
import "./cddi-route.css";

export const metadata: Metadata = {
  title: "CDDI 2026 | AgSUS Avaliações",
  description: "Ciclo de Devolutivas e Desenvolvimento Individual da AgSUS.",
};

export default function CddiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CddiScrollBoundary>{children}</CddiScrollBoundary>;
}
