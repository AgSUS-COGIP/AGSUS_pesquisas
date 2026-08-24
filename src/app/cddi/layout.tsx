import type { Metadata } from "next";
import { CddiScrollBoundary } from "@/components/cddi-scroll-boundary";
import { DEFAULT_PLATFORM_BRANDING, platformBrandingTitle } from "@/lib/platform-branding";
import "./cddi-route.css";

export const metadata: Metadata = {
  /*
    Sem o ano. Este metadata e' estatico — resolvido no servidor, antes de a
    tela saber qual ciclo a pessoa vai abrir —, entao qualquer ano escrito aqui
    vira mentira na edicao seguinte, e numa aba do navegador ninguem confere.
    O ciclo concreto aparece no titulo da propria tela, que o carrega do banco.
  */
  title: `CDDI | ${platformBrandingTitle(DEFAULT_PLATFORM_BRANDING)}`,
  description: "Ciclo de Devolutivas e Desenvolvimento Individual da AgSUS.",
};

export default function CddiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CddiScrollBoundary>{children}</CddiScrollBoundary>;
}
