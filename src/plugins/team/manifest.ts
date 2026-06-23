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
      label: "Permitir auto-cadastro",
      type: "boolean",
      description: "Permite que novos usuarios se registrem sem admin.",
      defaultValue: false,
    },
    {
      key: "defaultRole",
      label: "Papel padrao",
      type: "select",
      options: [
        { value: "researcher", label: "Pesquisador" },
        { value: "phd", label: "Doutorando" },
        { value: "msc", label: "Mestrando" },
        { value: "student", label: "Aluno" },
      ],
      defaultValue: "student",
    },
  ],
  defaultSettings: {
    allowSelfRegistration: false,
    defaultRole: "student",
  },
};
