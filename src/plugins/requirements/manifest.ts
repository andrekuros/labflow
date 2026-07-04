import type { PluginManifest } from "@/plugins/types";

export const requirementsManifest: PluginManifest = {
  id: "requirements",
  name: "Requisitos",
  version: "1.0.0",
  description: "Metas e requisitos com rastreabilidade a atividades e entregaveis.",
  icon: "Target",
  requires: ["projects"],
  // nav consolidated into /planning
  apiPrefix: "/api/v1/requirements",
  settingsSchema: [
    {
      key: "codePrefix",
      label: "Prefixo de codigo",
      type: "text",
      defaultValue: "REQ",
    },
    {
      key: "requireApproval",
      label: "Exigir aprovacao antes de implementar",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultSettings: { codePrefix: "REQ", requireApproval: true },
};
