export const COLUMN_TITLES: Record<string, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Revisao",
  done: "Concluido",
};

export const FALLBACK_COLUMN_IDS = ["backlog", "todo", "in_progress", "review", "done"];

export type BoardColumnDef = { id: string; title: string };

export function parseColumnIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean);
  return ids.length > 0 ? ids : null;
}

export function columnDefsFromIds(ids: string[]): BoardColumnDef[] {
  return ids.map((id) => ({
    id,
    title: COLUMN_TITLES[id] ?? id.replace(/_/g, " "),
  }));
}

/** Uniao de listas preservando a ordem de aparicao. */
export function mergeColumnIds(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function resolveBoardColumnsForView(
  projectColumns: Record<string, string[]>,
  selectedProjectId: string,
  taskStatuses: string[],
): BoardColumnDef[] {
  let ids: string[];
  if (selectedProjectId && projectColumns[selectedProjectId]?.length) {
    ids = [...projectColumns[selectedProjectId]];
  } else {
    ids = mergeColumnIds(Object.values(projectColumns));
    if (ids.length === 0) ids = [...FALLBACK_COLUMN_IDS];
  }

  for (const status of taskStatuses) {
    if (!ids.includes(status)) ids.push(status);
  }

  return columnDefsFromIds(ids);
}
