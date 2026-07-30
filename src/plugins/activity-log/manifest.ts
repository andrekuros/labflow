import type { PluginManifest } from "@/plugins/types";

export const activityLogManifest: PluginManifest = {
  id: "activity-log",
  name: "Registro de atividades",
  version: "1.0.0",
  description: "Timeline global de acoes dos usuarios para administradores.",
  icon: "ScrollText",
  nav: {
    label: "Atividades",
    href: "/activity-log",
    icon: "ScrollText",
    order: 86,
    group: "Administracao",
  },
  apiPrefix: "/api/v1/activity-log",
  settingsSchema: [
    {
      key: "defaultPeriodDays",
      label: "Periodo padrao (dias)",
      type: "number",
      defaultValue: 7,
    },
    {
      key: "pageSize",
      label: "Itens por pagina",
      type: "number",
      defaultValue: 50,
    },
  ],
  defaultSettings: { defaultPeriodDays: 7, pageSize: 50 },
};
