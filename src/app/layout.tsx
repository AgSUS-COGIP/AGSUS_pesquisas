import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AppProviders } from "@/components/app-providers";
import { platformSidebarBootstrapScript } from "@/lib/platform-sidebar";
import { platformThemeBootstrapScript } from "@/lib/platform-theme";
import "./globals.css";
import "./theme-foundation.css";
import "./theme-enhancements.css";
import "./sidebar-monitora.css";

export const metadata: Metadata = {
  title: {
    default: "AgSUS Avaliações",
    template: "%s | AgSUS",
  },
  description: "Plataforma institucional de avaliações e formulários da AgSUS.",
  icons: {
    icon: "/agsus-logo.png",
    shortcut: "/agsus-logo.png",
    apple: "/agsus-logo.png",
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
    <html lang="pt-BR" className="min-h-full" suppressHydrationWarning>
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
