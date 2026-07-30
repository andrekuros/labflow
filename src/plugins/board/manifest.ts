import type { PluginManifest } from "@/plugins/types";

export const boardManifest: PluginManifest = {
  id: "board",
  name: "Kanban",
  version: "1.0.0",
  description: "Quadro com drag-and-drop, filtros multiplos, modelos salvos e colunas ocultaveis.",
  icon: "KanbanSquare",
  requires: ["projects"],
  nav: { label: "Kanban", href: "/board", icon: "KanbanSquare", order: 10, group: "Trabalho" },
  apiPrefix: "/api/v1/board",
  settingsSchema: [
    {
      key: "columns",
      label: "Colunas do Kanban (JSON)",
      type: "json",
      description: 'Array de status, ex: ["backlog","todo","in_progress","review","done"]',
      defaultValue: ["backlog", "todo", "in_progress", "review", "done"],
    },
    {
      key: "enableDragDrop",
      label: "Habilitar drag-and-drop",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultSettings: {
    columns: ["backlog", "todo", "in_progress", "review", "done"],
    enableDragDrop: true,
  },
  lifecycle: {
    onSettingsChange: async ({ settings, previous }) => {
      console.log("[plugin:board] settings atualizadas", { previous, settings });
    },
  },
};
