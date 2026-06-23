import type { PluginManifest } from "@/plugins/types";

export const assistantManifest: PluginManifest = {
  id: "assistant",
  name: "Assistente IA",
  version: "1.0.0",
  description: "Respostas baseadas no conhecimento acumulado (RAG) e ferramentas de plugins.",
  icon: "Bot",
  requires: ["knowledge"],
  nav: { label: "Assistente IA", href: "/assistant", icon: "Bot", order: 85, group: "Conhecimento" },
  apiPrefix: "/api/v1/assistant",
  settingsSchema: [
    {
      key: "aiProvider",
      label: "Provedor de IA",
      type: "select",
      options: [
        { value: "none", label: "Offline (sem LLM)" },
        { value: "openai", label: "OpenAI / API compativel" },
        { value: "ollama", label: "Ollama (local)" },
      ],
      defaultValue: "none",
    },
    {
      key: "aiApiKey",
      label: "Chave de API",
      type: "secret",
      description: "Obrigatoria para OpenAI. Deixe em branco para manter a chave atual.",
    },
    {
      key: "aiBaseUrl",
      label: "URL base",
      type: "text",
      description: "OpenAI: https://api.openai.com/v1 | Ollama: http://127.0.0.1:11434",
      defaultValue: "",
    },
    {
      key: "aiChatModel",
      label: "Modelo de chat",
      type: "text",
      defaultValue: "gpt-4o-mini",
    },
    {
      key: "aiEmbeddingModel",
      label: "Modelo de embeddings",
      type: "text",
      description: "Usado com OpenAI. Ollama usa embeddings locais.",
      defaultValue: "text-embedding-3-small",
    },
    {
      key: "defaultAgentKey",
      label: "Agente padrao",
      type: "text",
      defaultValue: "task_assistant",
    },
    {
      key: "maxContextChunks",
      label: "Maximo de trechos no contexto",
      type: "number",
      defaultValue: 8,
    },
  ],
  defaultSettings: {
    aiProvider: "none",
    aiApiKey: "",
    aiBaseUrl: "",
    aiChatModel: "gpt-4o-mini",
    aiEmbeddingModel: "text-embedding-3-small",
    defaultAgentKey: "task_assistant",
    maxContextChunks: 8,
  },
};
