import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AppProviders } from "@/components/app-providers";
import { DEFAULT_PLATFORM_BRANDING, OFFICIAL_PLATFORM_LOGO_URL } from "@/lib/platform-branding";
import { platformSidebarBootstrapScript } from "@/lib/platform-sidebar";
import { platformThemeBootstrapScript } from "@/lib/platform-theme";
import "./globals.css";
import "./theme-foundation.css";
import "./theme-enhancements.css";
import "./dark-theme.css";
import "./sidebar-monitora.css";
import "./monitor-dashboard.css";

/*
  O título sai de `DEFAULT_PLATFORM_BRANDING`, e não de texto repetido à mão.
  Não é a marca configurada: `metadata` é estático e não lê o banco, então
  renomear o produto em /admin/configuracoes muda o cabeçalho da aplicação e
  **não** muda o título da aba. A dívida está descrita em
  `src/lib/platform-branding.ts`; derivar da constante ao menos garante que o
  nome apareça igual em todo lugar que não pode consultar o banco.
*/
export const metadata: Metadata = {
  title: {
    // Só a sigla na aba: o favicon ao lado já é a cruz da AgSUS, e repetir
    // "AgSUS" no texto gastava o espaço da aba dizendo duas vezes a mesma
    // coisa. O nome completo continua no cabeçalho da aplicação e na tela de
    // acesso, onde há largura para ele.
    default: DEFAULT_PLATFORM_BRANDING.productName,
    template: `%s | ${DEFAULT_PLATFORM_BRANDING.productName}`,
  },
  description: `${DEFAULT_PLATFORM_BRANDING.productDescription} — plataforma institucional de pesquisas e avaliações da ${DEFAULT_PLATFORM_BRANDING.organizationName}.`,
  icons: {
    icon: OFFICIAL_PLATFORM_LOGO_URL,
    shortcut: OFFICIAL_PLATFORM_LOGO_URL,
    apple: OFFICIAL_PLATFORM_LOGO_URL,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#08111f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="min-h-full" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-screen font-sans font-medium antialiased">
        <Script
          id="agsus-theme-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: platformThemeBootstrapScript() }}
        />
        <Script
          id="agsus-sidebar-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: platformSidebarBootstrapScript() }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
