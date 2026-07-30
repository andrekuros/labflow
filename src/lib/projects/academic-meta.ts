/** Academic metadata stored on thesis/dissertation projects. */

export type AcademicCourse = {
  code: string;
  name: string;
  status: string;
  grade?: string;
};

export type AcademicPending = {
  title: string;
  kind: string;
  dueDate?: string;
  status: string;
};

export type ProjectAcademicMeta = {
  motivation: string;
  objective: string;
  problemStatement: string;
  hypothesis: string;
  methodology: string;
  theoreticalFramework: string;
  academicContribution: string;
  expectedResults: string;
  limitations: string;
  notes: string;
  advisorName: string;
  coAdvisorName: string;
  startDate: string | null;
  expectedDefenseDate: string | null;
  courses: AcademicCourse[];
  pending: AcademicPending[];
  aiReviewsJson: string;
  aiReportJson: string;
  /** Legacy profile user id after migration (idempotency). */
  migratedFromUserId?: string;
};

export const EMPTY_ACADEMIC_META: ProjectAcademicMeta = {
  motivation: "",
  objective: "",
  problemStatement: "",
  hypothesis: "",
  methodology: "",
  theoreticalFramework: "",
  academicContribution: "",
  expectedResults: "",
  limitations: "",
  notes: "",
  advisorName: "",
  coAdvisorName: "",
  startDate: null,
  expectedDefenseDate: null,
  courses: [],
  pending: [],
  aiReviewsJson: "{}",
  aiReportJson: "{}",
};

export function parseAcademicMeta(raw: string | null | undefined): ProjectAcademicMeta {
  if (!raw) return { ...EMPTY_ACADEMIC_META, courses: [], pending: [] };
  try {
    const p = JSON.parse(raw) as Partial<ProjectAcademicMeta>;
    return {
      ...EMPTY_ACADEMIC_META,
      ...p,
      courses: Array.isArray(p.courses) ? p.courses : [],
      pending: Array.isArray(p.pending) ? p.pending : [],
      startDate: p.startDate ?? null,
      expectedDefenseDate: p.expectedDefenseDate ?? null,
    };
  } catch {
    return { ...EMPTY_ACADEMIC_META, courses: [], pending: [] };
  }
}

export function serializeAcademicMeta(meta: ProjectAcademicMeta): string {
  return JSON.stringify(meta);
}
