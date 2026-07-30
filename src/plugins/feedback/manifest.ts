import type { PluginManifest } from "@/plugins/types";

export const feedbackManifest: PluginManifest = {
  id: "feedback",
  name: "Demandas",
  version: "1.0.0",
  description: "Bugs, sugestoes, duvidas e pedidos de material ou necessidades do laboratorio.",
  icon: "ClipboardList",
  nav: { label: "Demandas", href: "/feedback", icon: "ClipboardList", order: 82, group: "Administracao" },
  apiPrefix: "/api/v1/feedback",
  settingsSchema: [
    {
      key: "feedbackProjectId",
      label: "Projeto para receber sugestoes da IA",
      type: "text",
      description: "ID ou chave do projeto onde a IA criara drafts de tarefas/requisitos a partir da demanda.",
      defaultValue: "",
    },
  ],
  defaultSettings: { feedbackProjectId: "" },
};
