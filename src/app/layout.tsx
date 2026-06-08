import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "./theme-script";
import { DEFAULT_MODE, DEFAULT_PALETTE } from "@/lib/themes";

export const metadata: Metadata = {
  title: "LabFlow - Gestao de Laboratorio de Pesquisa",
  description:
    "Kanban, projetos, sprints, roadmap, entregaveis, conhecimento, foruns e agentes de IA para laboratorios de pesquisa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-palette={DEFAULT_PALETTE} data-mode={DEFAULT_MODE} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
