export const ARTIFACTS_FORMAT_VERSION = "1.0";

export type ConopsData = {
  mission: string;
  scope: string;
  stakeholders: string;
  operatingEnvironment: string;
  conceptOfOperations: string;
  constraints: string;
  successCriteria: string;
  assumptions: string;
};

export const EMPTY_CONOPS: ConopsData = {
  mission: "",
  scope: "",
  stakeholders: "",
  operatingEnvironment: "",
  conceptOfOperations: "",
  constraints: "",
  successCriteria: "",
  assumptions: "",
};

export type ArtifactType =
  | "requirement"
  | "task"
  | "deliverable"
  | "work_package"
  | "milestone"
  | "system_element"
  | "verification_case";

export const ARTIFACT_TYPES: ArtifactType[] = [
  "requirement",
  "task",
  "deliverable",
  "work_package",
  "milestone",
  "system_element",
  "verification_case",
];

export type ArtifactsBundle = {
  version: string;
  projectKey?: string;
  projectName?: string;
  exportedAt: string;
  conops?: Partial<ConopsData>;
  requirements?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  deliverables?: Record<string, unknown>[];
  workPackages?: Record<string, unknown>[];
  milestones?: Record<string, unknown>[];
  systemElements?: Record<string, unknown>[];
  verificationCases?: Record<string, unknown>[];
};

export function parseConops(raw: string | null | undefined): ConopsData {
  if (!raw) return { ...EMPTY_CONOPS };
  try {
    const parsed = JSON.parse(raw) as Partial<ConopsData>;
    return { ...EMPTY_CONOPS, ...parsed };
  } catch {
    return { ...EMPTY_CONOPS };
  }
}

export function draftTitle(type: ArtifactType, data: Record<string, unknown>): string {
  const t = String(data.title ?? data.name ?? data.code ?? type);
  return t.slice(0, 120);
}
