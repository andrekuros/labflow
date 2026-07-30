export type TaskChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  order: number;
};

export function parseChecklist(raw: string | null | undefined): TaskChecklistItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const title = String(row.title ?? "").trim();
        if (!title) return null;
        return {
          id: String(row.id ?? `step-${index}`),
          title,
          done: Boolean(row.done),
          order: typeof row.order === "number" ? row.order : index,
        };
      })
      .filter((item): item is TaskChecklistItem => item !== null)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export function serializeChecklist(items: TaskChecklistItem[]): string {
  return JSON.stringify(
    items.map((item, index) => ({ ...item, order: index })),
  );
}

export function checklistProgress(items: TaskChecklistItem[]): { done: number; total: number; pct: number } {
  const total = items.length;
  if (total === 0) return { done: 0, total: 0, pct: 0 };
  const done = items.filter((i) => i.done).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function newChecklistItem(title: string, order: number): TaskChecklistItem {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim(),
    done: false,
    order,
  };
}
