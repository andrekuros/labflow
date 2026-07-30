/** Workspace context — kind filter toggles (academic / publications / development / admin). */

import type { ProjectKind } from "@/lib/projects/features";
import {
  ADMIN_KINDS,
  LAB_KINDS,
  PAPER_KINDS,
  PROJECT_KINDS,
  THESIS_KINDS,
} from "@/lib/projects/features";

export type WorkspaceMode = "all" | "project" | "filter";

export type KindToggleKey = "academic" | "publications" | "development" | "admin";

export type KindToggles = Record<KindToggleKey, boolean>;

export type WorkspacePrefs = {
  mode: WorkspaceMode;
  projectId?: string | null;
  /** Derived / legacy: kinds included when filtering. */
  includeKinds?: ProjectKind[];
  /** Primary UI: which scope icons are active. */
  kindToggles?: KindToggles;
  onlyMine?: boolean;
  savedPresets?: { id: string; label: string; mode: "filter"; includeKinds: ProjectKind[] }[];
};

export const DEFAULT_KIND_TOGGLES: KindToggles = {
  academic: true,
  publications: true,
  development: true,
  admin: true,
};

export const DEFAULT_WORKSPACE: WorkspacePrefs = {
  mode: "all",
  projectId: null,
  includeKinds: undefined,
  kindToggles: { ...DEFAULT_KIND_TOGGLES },
  onlyMine: false,
  savedPresets: [],
};

export const KIND_TOGGLE_META: {
  key: KindToggleKey;
  label: string;
  kinds: ProjectKind[];
  activeColor: string;
  icon: "GraduationCap" | "BookOpen" | "Code2" | "Shield";
}[] = [
  {
    key: "academic",
    label: "Teses e dissertacoes",
    kinds: [...THESIS_KINDS],
    activeColor: "#7c3aed",
    icon: "GraduationCap",
  },
  {
    key: "publications",
    label: "Publicacoes",
    kinds: [...PAPER_KINDS],
    activeColor: "#db2777",
    icon: "BookOpen",
  },
  {
    key: "development",
    label: "Desenvolvimento",
    kinds: [...LAB_KINDS],
    activeColor: "#0ea5e9",
    icon: "Code2",
  },
  {
    key: "admin",
    label: "Admin",
    kinds: [...ADMIN_KINDS],
    activeColor: "#f59e0b",
    icon: "Shield",
  },
];

function togglesFromIncludeKinds(includeKinds: ProjectKind[] | undefined): KindToggles {
  if (!includeKinds?.length) return { ...DEFAULT_KIND_TOGGLES };
  const set = new Set(includeKinds);
  return {
    academic: THESIS_KINDS.some((k) => set.has(k)),
    publications: PAPER_KINDS.some((k) => set.has(k)),
    development: LAB_KINDS.some((k) => set.has(k)),
    admin: ADMIN_KINDS.some((k) => set.has(k)),
  };
}

export function normalizeKindToggles(raw: unknown): KindToggles {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_KIND_TOGGLES };
  const t = raw as Record<string, unknown>;
  // Legacy prefs without publications: if academic was on and paper kinds were included, keep pubs on
  const hasPubsKey = "publications" in t;
  return {
    academic: t.academic !== false,
    publications: hasPubsKey ? t.publications !== false : t.academic !== false,
    development: t.development !== false,
    admin: t.admin !== false,
  };
}

/** Kinds implied by current toggles. Empty / all-on → undefined (no filter). */
export function kindsFromToggles(toggles: KindToggles): ProjectKind[] | undefined {
  const kinds: ProjectKind[] = [];
  for (const meta of KIND_TOGGLE_META) {
    if (toggles[meta.key]) kinds.push(...meta.kinds);
  }
  const allOn = KIND_TOGGLE_META.every((m) => toggles[m.key]);
  const allOff = KIND_TOGGLE_META.every((m) => !toggles[m.key]);
  if (allOn || allOff) return undefined;
  return kinds;
}

export function workspaceFromToggles(
  toggles: KindToggles,
  prev?: WorkspacePrefs,
): WorkspacePrefs {
  const includeKinds = kindsFromToggles(toggles);
  return {
    ...DEFAULT_WORKSPACE,
    ...prev,
    kindToggles: { ...toggles },
    includeKinds,
    mode: includeKinds ? "filter" : "all",
    projectId: includeKinds ? null : prev?.projectId ?? null,
    onlyMine: false,
  };
}

export function parseWorkspace(raw: unknown): WorkspacePrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WORKSPACE, kindToggles: { ...DEFAULT_KIND_TOGGLES } };
  const w = raw as Record<string, unknown>;
  const mode = w.mode === "project" || w.mode === "filter" || w.mode === "all" ? w.mode : "all";
  const includeKinds = Array.isArray(w.includeKinds)
    ? (w.includeKinds.filter((k) => PROJECT_KINDS.includes(k as ProjectKind)) as ProjectKind[])
    : undefined;

  let kindToggles: KindToggles;
  if (w.kindToggles && typeof w.kindToggles === "object") {
    kindToggles = normalizeKindToggles(w.kindToggles);
  } else if (mode === "filter" && includeKinds?.length) {
    kindToggles = togglesFromIncludeKinds(includeKinds);
  } else {
    kindToggles = { ...DEFAULT_KIND_TOGGLES };
  }

  const derivedKinds = kindsFromToggles(kindToggles);

  return {
    mode: w.mode === "project" && typeof w.projectId === "string" ? "project" : derivedKinds ? "filter" : "all",
    projectId: typeof w.projectId === "string" ? w.projectId : null,
    includeKinds: derivedKinds,
    kindToggles,
    onlyMine: Boolean(w.onlyMine),
    savedPresets: [],
  };
}

export function isWorkspaceFocused(ws: WorkspacePrefs): boolean {
  const toggles = ws.kindToggles ?? DEFAULT_KIND_TOGGLES;
  const kinds = kindsFromToggles(toggles);
  return Boolean(kinds?.length) || (ws.mode === "project" && Boolean(ws.projectId));
}

export function workspaceLabel(ws: WorkspacePrefs): string {
  const toggles = ws.kindToggles ?? DEFAULT_KIND_TOGGLES;
  const active = KIND_TOGGLE_META.filter((m) => toggles[m.key]).map((m) => m.label);
  if (active.length === 0 || active.length === KIND_TOGGLE_META.length) return "Todo o laboratorio";
  return active.join(" · ");
}
