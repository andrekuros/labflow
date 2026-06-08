export type Person = { id: string; name: string; avatarColor: string };
export type LabelItem = { id: string; name: string; color: string; projectId: string };
export type SprintItem = { id: string; name: string; projectId: string; status: string };
export type ProjectItem = { id: string; key: string; name: string; color: string };

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
  projectKey: string;
  projectColor: string;
  sprintId: string | null;
  workPackageId: string | null;
  assignees: Person[];
  labels: { id: string; name: string; color: string }[];
};

export const COLUMNS: { id: string; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "A fazer" },
  { id: "in_progress", title: "Em andamento" },
  { id: "review", title: "Revisao" },
  { id: "done", title: "Concluido" },
];

export const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "#64748b" },
  medium: { label: "Media", color: "#3b82f6" },
  high: { label: "Alta", color: "#f59e0b" },
  urgent: { label: "Urgente", color: "#ef4444" },
};
