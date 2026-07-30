import type { PluginManifest } from "@/plugins/types";

async function ensureWeeklyScheduler() {
  const { startWeeklyReportScheduler } = await import("@/plugins/reports/weekly/scheduler");
  startWeeklyReportScheduler();
}

export const reportsManifest: PluginManifest = {
  id: "reports",
  name: "Relatorios",
  version: "1.1.1",
  description:
    "Relatorios de atividades por usuario/periodo, painel BI e relatorio semanal por email (PDF + IA) para administradores.",
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
    {
      key: "weeklyEmailEnabled",
      label: "Enviar relatorio semanal por email (admins)",
      type: "boolean",
      defaultValue: false,
      description: "Requer SMTP configurado no .env. Gera PDF com IA e envia aos usuarios admin.",
    },
    {
      key: "weeklyEmailDay",
      label: "Dia do envio semanal (0=domingo … 6=sabado)",
      type: "number",
      defaultValue: 1,
    },
    {
      key: "weeklyEmailHour",
      label: "Hora do envio semanal (0–23, horario local)",
      type: "number",
      defaultValue: 8,
    },
  ],
  defaultSettings: {
    reportPeriodDays: 14,
    includeAcademic: true,
    weeklyEmailEnabled: false,
    weeklyEmailDay: 1,
    weeklyEmailHour: 8,
  },
  lifecycle: {
    onBoot: async () => {
      await ensureWeeklyScheduler();
    },
    onEnable: async () => {
      await ensureWeeklyScheduler();
    },
    onSettingsChange: async ({ settings }) => {
      if (settings.weeklyEmailEnabled) {
        await ensureWeeklyScheduler();
      }
    },
  },
};
