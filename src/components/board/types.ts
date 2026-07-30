export type Person = { id: string; name: string; avatarColor: string };
export type LabelItem = { id: string; name: string; color: string; projectId: string };
export type SprintItem = { id: string; name: string; projectId: string; status: string };
export type WorkPackageItem = { id: string; code: string | null; name: string; projectId: string; parentId: string | null };
export type ProjectItem = { id: string; key: string; name: string; color: string };

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  priority: string;
  dueDate: string | null;
  projectId: string;
  projectKey: string;
  projectColor: string;
  sprintId: string | null;
  workPackageId: string | null;
  checklist?: TaskChecklistItem[];
  assignees: Person[];
  labels: { id: string; name: string; color: string }[];
};

import { FALLBACK_COLUMN_IDS, columnDefsFromIds } from "@/lib/board-columns";
import type { TaskChecklistItem } from "@/lib/task-checklist";

export const COLUMNS = columnDefsFromIds(FALLBACK_COLUMN_IDS);

export const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "#64748b" },
  medium: { label: "Media", color: "#3b82f6" },
  high: { label: "Alta", color: "#f59e0b" },
  urgent: { label: "Urgente", color: "#ef4444" },
};
