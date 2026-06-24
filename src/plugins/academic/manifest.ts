import type { PluginManifest } from "@/plugins/types";

export const academicManifest: PluginManifest = {
  id: "academic",
  name: "Acompanhamento academico",
  version: "1.0.0",
  description: "Metodologia cientifica, disciplinas e pendencias de mestrado/doutorado.",
  icon: "GraduationCap",
  nav: { label: "Acompanhamento", href: "/academic", icon: "GraduationCap", order: 85, group: "Pesquisa" },
  apiPrefix: "/api/v1/academic",
};
