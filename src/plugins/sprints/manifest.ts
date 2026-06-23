import type { PluginManifest } from "@/plugins/types";

export const sprintsManifest: PluginManifest = {
  id: "sprints",
  name: "Sprints",
  version: "1.0.0",
  description: "Ciclos de trabalho com metas, prazos e progresso.",
  icon: "Timer",
  requires: ["projects"],
  nav: { label: "Sprints", href: "/sprints", icon: "Timer", order: 30, group: "Trabalho" },
  apiPrefix: "/api/v1/sprints",
  settingsSchema: [
    {
      key: "defaultDurationWeeks",
      label: "Duracao padrao (semanas)",
      type: "number",
      defaultValue: 2,
    },
    {
      key: "autoActivateNext",
      label: "Ativar proxima sprint automaticamente",
      type: "boolean",
      defaultValue: false,
    },
  ],
  defaultSettings: { defaultDurationWeeks: 2, autoActivateNext: false },
};
