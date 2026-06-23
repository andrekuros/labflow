import type { PluginManifest } from "@/plugins/types";

export const deliverablesManifest: PluginManifest = {
  id: "deliverables",
  name: "Entregaveis",
  version: "1.0.0",
  description: "Produtos com criterios de aceitacao e rastreabilidade a requisitos.",
  icon: "PackageCheck",
  requires: ["projects"],
  nav: { label: "Entregaveis", href: "/deliverables", icon: "PackageCheck", order: 50, group: "Planejamento" },
  apiPrefix: "/api/v1/deliverables",
  settingsSchema: [
    {
      key: "requireAcceptanceCriteria",
      label: "Exigir criterios de aceitacao",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "defaultStatus",
      label: "Status inicial",
      type: "select",
      options: [
        { value: "pending", label: "Pendente" },
        { value: "in_progress", label: "Em andamento" },
      ],
      defaultValue: "pending",
    },
  ],
  defaultSettings: { requireAcceptanceCriteria: true, defaultStatus: "pending" },
};
