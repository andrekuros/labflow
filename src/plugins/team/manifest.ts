import type { PluginManifest } from "@/plugins/types";

export const teamManifest: PluginManifest = {
  id: "team",
  name: "Equipe",
  version: "1.0.0",
  description: "Perfis da equipe, papeis e visao geral dos integrantes.",
  icon: "Users",
  nav: { label: "Equipe", href: "/team", icon: "Users", order: 90, group: "Administracao" },
  apiPrefix: "/api/v1/team",
  settingsSchema: [
    {
      key: "allowSelfRegistration",
      label: "Permitir cadastro na tela de login",
      type: "boolean",
      description: "Novos usuarios se cadastram e aguardam aprovacao do administrador.",
      defaultValue: true,
    },
    {
      key: "defaultRole",
      label: "Papel padrao",
      type: "select",
      options: [
        { value: "researcher", label: "Pesquisador" },
        { value: "project_manager", label: "Gerente de Projetos" },
        { value: "contributor", label: "Colaborador" },
        { value: "viewer", label: "Visualizador" },
      ],
      defaultValue: "contributor",
    },
  ],
  defaultSettings: {
    allowSelfRegistration: true,
    defaultRole: "contributor",
  },
};
