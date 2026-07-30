import type { PluginManifest } from "@/plugins/types";

export const thesisManifest: PluginManifest = {
  id: "thesis",
  name: "Teses e dissertacoes",
  version: "1.0.0",
  description: "Trabalhos de pos-graduacao como projetos (metodologia, disciplinas, tarefas).",
  icon: "GraduationCap",
  requires: ["projects"],
  apiPrefix: "/api/v1/thesis",
};
