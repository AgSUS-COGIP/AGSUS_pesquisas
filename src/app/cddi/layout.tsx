import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CDDI 2026 | AgSUS Pesquisas",
  description: "Ciclo de Devolutivas e Desenvolvimento Individual da AgSUS.",
};

export default function CddiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
