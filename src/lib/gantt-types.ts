/** Gantt types — pure, importable from client components. */

export type GanttRowKind =
  | "project"
  | "work_package"
  | "sprint"
  | "task"
  | "milestone"
  | "deliverable";

export type GanttRow = {
  /** Unique across the tree: `${kind}:${entityId}`. */
  id: string;
  entityId: string;
  kind: GanttRowKind;
  parentId: string | null;
  depth: number;
  label: string;
  /** WBS code or project key, shown before the label. */
  code: string | null;
  projectId: string;
  projectKey: string;
  color: string;
  status: string;
  start: string | null;
  end: string | null;
  /** Dates derived from descendants, not stored on the row itself. */
  rolledUp: boolean;
  /** The row had only a due date, so the start was inferred — drawn hatched. */
  inferredStart: boolean;
  /** Zero-duration row: drawn as a diamond, not a bar. */
  point: boolean;
  progressPct: number;
  overdue: boolean;
  assignees: string[];
  childCount: number;
  href: string | null;
};

export type GanttUnplaced = {
  projectId: string;
  projectKey: string;
  tasks: number;
  deliverables: number;
  milestones: number;
};

export type GanttData = {
  /** Outer bounds of every placed row, padded to whole weeks. */
  range: { start: string; end: string };
  today: string;
  rows: GanttRow[];
  projects: { id: string; key: string; name: string; color: string; kind: string }[];
  /** Work that has no usable date and therefore cannot appear on the chart. */
  unplaced: GanttUnplaced[];
  counts: { placed: number; unplaced: number };
};
