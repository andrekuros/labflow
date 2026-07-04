import type { PluginManifest } from "@/plugins/types";

export const planningManifest: PluginManifest = {
  id: "planning",
  name: "Planejamento",
  version: "1.0.0",
  description: "Requisitos, entregaveis, roadmap e sprints em uma unica visao por projeto.",
  icon: "FolderKanban",
  requires: ["projects"],
  nav: { label: "Planejamento", href: "/planning", icon: "FolderKanban", order: 35, group: "Trabalho" },
  apiPrefix: "/api/v1/planning",
};
