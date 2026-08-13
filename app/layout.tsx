import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Endereço Digital Hub",
  description: "Plataforma white-label da Endereço Digital.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

export const dynamic = "force-dynamic";
