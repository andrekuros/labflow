import type { PluginManifest } from "@/plugins/types";

export const feedbackManifest: PluginManifest = {
  id: "feedback",
  name: "Feedback",
  version: "1.0.0",
  description: "Reporte erros e sugira melhorias. A IA pode gerar tarefas e requisitos a partir do seu feedback.",
  icon: "MessageSquareWarning",
  nav: { label: "Feedback", href: "/feedback", icon: "MessageSquareWarning", order: 88, group: "Administracao" },
  apiPrefix: "/api/v1/feedback",
  settingsSchema: [
    {
      key: "feedbackProjectId",
      label: "Projeto para receber sugestoes da IA",
      type: "text",
      description: "ID ou chave do projeto onde a IA criara drafts de tarefas/requisitos a partir do feedback.",
      defaultValue: "",
    },
  ],
  defaultSettings: { feedbackProjectId: "" },
};
