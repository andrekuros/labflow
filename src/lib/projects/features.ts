/** Feature flags and project kinds — shared client/server. */

export const PROJECT_KINDS = ["lab", "admin", "thesis", "dissertation", "paper"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  lab: "Projeto de laboratorio",
  admin: "Projeto administrativo",
  thesis: "Tese",
  dissertation: "Dissertacao",
  paper: "Artigo",
};

export const THESIS_KINDS: ProjectKind[] = ["thesis", "dissertation"];
export const PAPER_KINDS: ProjectKind[] = ["paper"];
export const ACADEMIC_KINDS: ProjectKind[] = [...THESIS_KINDS, ...PAPER_KINDS];
export const LAB_KINDS: ProjectKind[] = ["lab"];
export const ADMIN_KINDS: ProjectKind[] = ["admin"];

export const PROJECT_FEATURES = [
  "wbs",
  "requirements",
  "deliverables",
  "sprints",
  "roadmap",
  "systemModel",
  "verification",
  "conops",
  "board",
  "knowledge",
  "forum",
  "methodology",
  "courses",
  "paperPipeline",
] as const;

export type ProjectFeature = (typeof PROJECT_FEATURES)[number];

export const PROJECT_FEATURE_LABELS: Record<ProjectFeature, string> = {
  wbs: "WBS / Pacotes de trabalho",
  requirements: "Requisitos",
  deliverables: "Entregaveis",
  sprints: "Sprints",
  roadmap: "Roadmap / Marcos",
  systemModel: "Modelo do sistema",
  verification: "Verificacao",
  conops: "CONOPS",
  board: "Kanban / Tarefas",
  knowledge: "Base de conhecimento",
  forum: "Forum",
  methodology: "Metodologia cientifica",
  courses: "Disciplinas e pendencias",
  paperPipeline: "Pipeline de publicacao",
};

export type ProjectFeatures = Record<ProjectFeature, boolean>;

const ALL_ON = Object.fromEntries(PROJECT_FEATURES.map((f) => [f, true])) as ProjectFeatures;

function withDefaults(partial: Partial<ProjectFeatures>): ProjectFeatures {
  return { ...ALL_ON, ...partial };
}

export const FEATURES_BY_KIND: Record<ProjectKind, ProjectFeatures> = {
  lab: withDefaults({ methodology: false, courses: false, paperPipeline: false }),
  admin: withDefaults({
    wbs: false,
    requirements: false,
    deliverables: false,
    sprints: false,
    roadmap: false,
    systemModel: false,
    verification: false,
    conops: false,
    methodology: false,
    courses: false,
    paperPipeline: false,
    board: true,
    knowledge: true,
    forum: true,
  }),
  thesis: withDefaults({
    wbs: false,
    requirements: false,
    deliverables: true,
    sprints: true,
    roadmap: true,
    systemModel: false,
    verification: false,
    conops: false,
    board: true,
    knowledge: true,
    forum: true,
    methodology: true,
    courses: true,
    paperPipeline: false,
  }),
  dissertation: withDefaults({
    wbs: false,
    requirements: false,
    deliverables: true,
    sprints: true,
    roadmap: true,
    systemModel: false,
    verification: false,
    conops: false,
    board: true,
    knowledge: true,
    forum: true,
    methodology: true,
    courses: true,
    paperPipeline: false,
  }),
  paper: withDefaults({
    wbs: false,
    requirements: false,
    deliverables: true,
    sprints: false,
    roadmap: true,
    systemModel: false,
    verification: false,
    conops: false,
    board: true,
    knowledge: true,
    forum: true,
    methodology: true,
    courses: false,
    paperPipeline: true,
  }),
};

export function isProjectKind(value: string): value is ProjectKind {
  return (PROJECT_KINDS as readonly string[]).includes(value);
}

export function defaultFeaturesForKind(kind: ProjectKind): ProjectFeatures {
  return { ...FEATURES_BY_KIND[kind] };
}

export function parseProjectFeatures(
  raw: string | null | undefined,
  kind: ProjectKind = "lab",
): ProjectFeatures {
  const base = defaultFeaturesForKind(kind);
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
    const out = { ...base };
    for (const key of PROJECT_FEATURES) {
      if (typeof parsed[key] === "boolean") out[key] = parsed[key]!;
    }
    return out;
  } catch {
    return base;
  }
}

export function serializeProjectFeatures(features: ProjectFeatures): string {
  return JSON.stringify(features);
}

export function hasProjectFeature(
  features: ProjectFeatures,
  feature: ProjectFeature,
): boolean {
  return Boolean(features[feature]);
}

export function isAcademicKind(kind: string): boolean {
  return ACADEMIC_KINDS.includes(kind as ProjectKind);
}
