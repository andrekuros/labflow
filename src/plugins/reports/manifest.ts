import type { PluginManifest } from "@/plugins/types";

export const reportsManifest: PluginManifest = {
  id: "reports",
  name: "Relatorios",
  version: "1.0.0",
  description: "Relatorios de atividades por usuario/periodo e painel BI para administradores.",
  icon: "BarChart3",
  requires: ["projects"],
  nav: { label: "Relatorios", href: "/reports", icon: "BarChart3", order: 80, group: "Gestao" },
  apiPrefix: "/api/v1/reports",
  settingsSchema: [
    {
      key: "reportPeriodDays",
      label: "Periodo padrao (dias)",
      type: "number",
      defaultValue: 14,
    },
    {
      key: "includeAcademic",
      label: "Incluir dados academicos nos relatorios",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultSettings: { reportPeriodDays: 14, includeAcademic: true },
};
