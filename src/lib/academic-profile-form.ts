import type { AcademicFormData, CourseRow, PendingRow } from "@/plugins/academic/actions";

export type AcademicProfileRecord = {
  program: string;
  status: string;
  motivation: string;
  objective: string;
  problemStatement: string;
  hypothesis: string;
  methodology: string;
  academicContribution: string;
  expectedResults: string;
  limitations: string;
  theoreticalFramework: string;
  advisorName: string | null;
  coAdvisorName: string | null;
  startDate: Date | null;
  expectedDefenseDate: Date | null;
  coursesJson: string;
  pendingJson: string;
  notes: string;
  aiReviewsJson: string;
};

export function profileToForm(profile: AcademicProfileRecord): AcademicFormData {
  let courses: CourseRow[] = [];
  let pending: PendingRow[] = [];
  try {
    courses = JSON.parse(profile.coursesJson);
    pending = JSON.parse(profile.pendingJson);
  } catch {
    /* ignore */
  }
  return {
    program: profile.program,
    status: profile.status,
    motivation: profile.motivation,
    objective: profile.objective,
    problemStatement: profile.problemStatement,
    hypothesis: profile.hypothesis,
    methodology: profile.methodology,
    academicContribution: profile.academicContribution,
    expectedResults: profile.expectedResults,
    limitations: profile.limitations,
    theoreticalFramework: profile.theoreticalFramework,
    advisorName: profile.advisorName ?? "",
    coAdvisorName: profile.coAdvisorName ?? "",
    startDate: profile.startDate?.toISOString().slice(0, 10) ?? "",
    expectedDefenseDate: profile.expectedDefenseDate?.toISOString().slice(0, 10) ?? "",
    courses,
    pending,
    notes: profile.notes,
  };
}
