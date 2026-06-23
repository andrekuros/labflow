import type { PluginManifest } from "@/plugins/types";

export const projectsManifest: PluginManifest = {
  id: "projects",
  name: "Projetos",
  version: "1.0.0",
  description: "Linhas de pesquisa com WBS, equipe e categorias.",
  icon: "FolderKanban",
  nav: { label: "Projetos", href: "/projects", icon: "FolderKanban", order: 20, group: "Trabalho" },
  apiPrefix: "/api/v1/projects",
  settingsSchema: [
    {
      key: "defaultColor",
      label: "Cor padrao de projetos",
      type: "text",
      defaultValue: "#6366f1",
    },
    {
      key: "maxKeyLength",
      label: "Tamanho maximo da chave",
      type: "number",
      defaultValue: 8,
    },
  ],
  defaultSettings: { defaultColor: "#6366f1", maxKeyLength: 8 },
};
