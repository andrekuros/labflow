export const CARD_FIELD_IDS = [
  "project",
  "priority",
  "labels",
  "assignees",
  "dueDate",
  "checklist",
] as const;

export type CardFieldId = (typeof CARD_FIELD_IDS)[number];

export type BoardFilters = {
  projects: string[];
  assignees: string[];
  labels: string[];
  sprints: string[];
  priorities: string[];
  search: string;
};

export type BoardViewState = {
  filters: BoardFilters;
  hiddenColumns: string[];
  cardFields: CardFieldId[];
};

export type SavedBoardView = BoardViewState & {
  id: string;
  name: string;
  slug: string;
};

export const DEFAULT_CARD_FIELDS: CardFieldId[] = [...CARD_FIELD_IDS];

export const CARD_FIELD_LABELS: Record<CardFieldId, string> = {
  project: "Projeto",
  priority: "Prioridade",
  labels: "Categorias",
  assignees: "Responsaveis",
  dueDate: "Prazo",
  checklist: "Checklist",
};

export function emptyBoardFilters(): BoardFilters {
  return {
    projects: [],
    assignees: [],
    labels: [],
    sprints: [],
    priorities: [],
    search: "",
  };
}

export function defaultBoardViewState(): BoardViewState {
  return {
    filters: emptyBoardFilters(),
    hiddenColumns: [],
    cardFields: [...DEFAULT_CARD_FIELDS],
  };
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

function asCardFields(raw: unknown): CardFieldId[] {
  const allowed = new Set<string>(CARD_FIELD_IDS);
  const list = asStringArray(raw).filter((id): id is CardFieldId => allowed.has(id));
  return list.length > 0 ? list : [...DEFAULT_CARD_FIELDS];
}

export function parseBoardViewState(raw: unknown): BoardViewState {
  if (!raw || typeof raw !== "object") return defaultBoardViewState();
  const o = raw as Record<string, unknown>;
  const filtersRaw = o.filters && typeof o.filters === "object" ? (o.filters as Record<string, unknown>) : o;
  return {
    filters: {
      projects: asStringArray(filtersRaw.projects),
      assignees: asStringArray(filtersRaw.assignees),
      labels: asStringArray(filtersRaw.labels),
      sprints: asStringArray(filtersRaw.sprints),
      priorities: asStringArray(filtersRaw.priorities),
      search: typeof filtersRaw.search === "string" ? filtersRaw.search : "",
    },
    hiddenColumns: asStringArray(o.hiddenColumns),
    cardFields: asCardFields(o.cardFields),
  };
}

export function parseSavedBoardViews(raw: unknown): SavedBoardView[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedBoardView[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const slug = typeof o.slug === "string" ? o.slug.trim() : "";
    if (!id || !name || !slug) continue;
    out.push({ id, name, slug, ...parseBoardViewState(o) });
  }
  return out;
}

export function slugifyBoardViewName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "view";
}

export function uniqueBoardViewSlug(base: string, existing: SavedBoardView[], excludeId?: string): string {
  const taken = new Set(existing.filter((v) => v.id !== excludeId).map((v) => v.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function csvParam(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Lê estado do quadro a partir da query string (sem named view). */
export function boardStateFromSearchParams(sp: URLSearchParams): BoardViewState {
  const cards = csvParam(sp, "cards").filter((id): id is CardFieldId =>
    (CARD_FIELD_IDS as readonly string[]).includes(id),
  );
  return {
    filters: {
      projects: csvParam(sp, "projects"),
      assignees: csvParam(sp, "assignees"),
      labels: csvParam(sp, "labels"),
      sprints: csvParam(sp, "sprints"),
      priorities: csvParam(sp, "priorities"),
      search: sp.get("q") ?? "",
    },
    hiddenColumns: csvParam(sp, "hide"),
    cardFields: cards.length > 0 ? cards : [...DEFAULT_CARD_FIELDS],
  };
}

/** Serializa estado para query string (sem o param `view`). */
export function boardStateToSearchParams(state: BoardViewState): URLSearchParams {
  const sp = new URLSearchParams();
  const { filters, hiddenColumns, cardFields } = state;
  if (filters.projects.length) sp.set("projects", filters.projects.join(","));
  if (filters.assignees.length) sp.set("assignees", filters.assignees.join(","));
  if (filters.labels.length) sp.set("labels", filters.labels.join(","));
  if (filters.sprints.length) sp.set("sprints", filters.sprints.join(","));
  if (filters.priorities.length) sp.set("priorities", filters.priorities.join(","));
  if (filters.search.trim()) sp.set("q", filters.search.trim());
  if (hiddenColumns.length) sp.set("hide", hiddenColumns.join(","));
  const defaultCards = DEFAULT_CARD_FIELDS.join(",");
  const cards = cardFields.join(",");
  if (cards && cards !== defaultCards) sp.set("cards", cards);
  return sp;
}

export function boardStatesEqual(a: BoardViewState, b: BoardViewState): boolean {
  const norm = (s: BoardViewState) =>
    JSON.stringify({
      filters: {
        projects: [...s.filters.projects].sort(),
        assignees: [...s.filters.assignees].sort(),
        labels: [...s.filters.labels].sort(),
        sprints: [...s.filters.sprints].sort(),
        priorities: [...s.filters.priorities].sort(),
        search: s.filters.search.trim(),
      },
      hiddenColumns: [...s.hiddenColumns].sort(),
      cardFields: [...s.cardFields],
    });
  return norm(a) === norm(b);
}

/** Compat: query antiga `project` / `assignee` (singular). */
export function migrateLegacyBoardParams(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(sp.toString());
  if (!next.get("projects") && next.get("project")) {
    next.set("projects", next.get("project")!);
    next.delete("project");
  }
  if (!next.get("assignees") && next.get("assignee")) {
    next.set("assignees", next.get("assignee")!);
    next.delete("assignee");
  }
  return next;
}
