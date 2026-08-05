import type { Metadata } from "next";
import Script from "next/script";
import { AppProviders } from "@/components/app-providers";
import { platformSidebarBootstrapScript } from "@/lib/platform-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AgSUS Pesquisas e Avaliações",
    template: "%s | AgSUS",
  },
  description: "Plataforma institucional de pesquisas, avaliações e formulários da AgSUS.",
  icons: {
    icon: "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png",
    apple: "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="min-h-full bg-[#f3f7fb]" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f3f7fb] font-sans font-medium text-[#10243e] antialiased selection:bg-blue-200 selection:text-[#003b70]">
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
