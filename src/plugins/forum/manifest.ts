import type { PluginManifest } from "@/plugins/types";

export const forumManifest: PluginManifest = {
  id: "forum",
  name: "Foruns",
  version: "1.0.0",
  description: "Canais e topicos por projeto, com atualizacao near-realtime.",
  icon: "MessagesSquare",
  requires: ["projects"],
  nav: { label: "Foruns", href: "/forum", icon: "MessagesSquare", order: 80, group: "Conhecimento" },
  apiPrefix: "/api/v1/forum",
  settingsSchema: [
    {
      key: "pollIntervalMs",
      label: "Intervalo de polling (ms)",
      type: "number",
      defaultValue: 5000,
    },
    {
      key: "allowAnonymousChannels",
      label: "Permitir canais globais",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultSettings: { pollIntervalMs: 5000, allowAnonymousChannels: true },
};
