import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgSUS Pesquisas",
  description: "Plataforma institucional de pesquisas, avaliações e formulários da AgSUS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
