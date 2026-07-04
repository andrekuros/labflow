import type { PluginManifest } from "@/plugins/types";

export const roadmapManifest: PluginManifest = {
  id: "roadmap",
  name: "Roadmap",
  version: "1.0.0",
  description: "Linha do tempo de marcos, verificacao/validacao e sprints.",
  icon: "Map",
  requires: ["projects", "sprints"],
  // nav consolidated into /planning
  apiPrefix: "/api/v1/roadmap",
  settingsSchema: [
    {
      key: "showSprints",
      label: "Exibir sprints na linha do tempo",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "highlightOverdue",
      label: "Destacar marcos atrasados",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultSettings: { showSprints: true, highlightOverdue: true },
};
