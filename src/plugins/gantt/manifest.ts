import type { PluginManifest } from "@/plugins/types";

export const ganttManifest: PluginManifest = {
  id: "gantt",
  name: "Gantt",
  version: "1.0.0",
  description:
    "Cronograma Gantt consolidado (projeto > pacote de trabalho > sprint/tarefa/marco/entregavel) com agregacao de datas pela WBS.",
  icon: "GanttChartSquare",
  requires: ["projects"],
  nav: { label: "Gantt", href: "/gantt", icon: "GanttChartSquare", order: 40, group: "Planejamento" },
  apiPrefix: "/api/v1/gantt",
  settingsSchema: [
    {
      key: "includeDone",
      label: "Exibir itens concluidos",
      type: "boolean",
      defaultValue: true,
      description: "Desligue para ver apenas o plano ainda em aberto.",
    },
    {
      key: "inferredDurationDays",
      label: "Duracao assumida para tarefa so com prazo (dias)",
      type: "number",
      defaultValue: 5,
      description:
        "Tarefas sem data de inicio ganham uma barra deste tamanho, sempre hachurada para deixar claro que a data foi inferida. Use 1 para marcar apenas o prazo.",
    },
    {
      key: "defaultZoom",
      label: "Zoom inicial",
      type: "select",
      options: [
        { value: "day", label: "Dia" },
        { value: "week", label: "Semana" },
        { value: "month", label: "Mes" },
        { value: "quarter", label: "Trimestre" },
      ],
      defaultValue: "week",
    },
  ],
  defaultSettings: { includeDone: true, inferredDurationDays: 5, defaultZoom: "week" },
};
