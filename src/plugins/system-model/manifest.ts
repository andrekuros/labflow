import type { PluginManifest } from "@/plugins/types";

export const systemModelManifest: PluginManifest = {
  id: "system-model",
  name: "Modelo do sistema",
  version: "1.0.0",
  description: "System of Interest, subsistemas, componentes e interfaces (MBSE leve).",
  icon: "Cpu",
  nav: { label: "Modelo SE", href: "/system-model", icon: "Cpu", order: 45, group: "Planejamento" },
  requires: ["projects"],
  apiPrefix: "/api/v1/system-model",
  defaultSettings: {},
};
