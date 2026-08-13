import type { Metadata } from "next";
import "./globals.css";
import { resolveHubByHost, brandStyle, DEFAULT_BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Endereço Digital Hub",
  description: "Plataforma white-label da Endereço Digital.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hub = await resolveHubByHost().catch(() => null);
  const style = brandStyle(hub);
  return (
    <html lang="pt-BR">
      <body style={style}>{children}</body>
    </html>
  );
}

export const dynamic = "force-dynamic";
