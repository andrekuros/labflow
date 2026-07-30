import type { PluginManifest } from "@/plugins/types";

export const papersManifest: PluginManifest = {
  id: "papers",
  name: "Artigos",
  version: "1.0.0",
  description: "Artigos cientificos como projetos com pipeline de publicacao.",
  icon: "FileText",
  requires: ["projects", "knowledge"],
  apiPrefix: "/api/v1/papers",
};
