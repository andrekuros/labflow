/** Tipos e parse de observações da IA — compartilhado client/server. */

export const ACADEMIC_REVIEW_FIELDS = [
  "motivation",
  "objective",
  "problemStatement",
  "hypothesis",
  "methodology",
  "theoreticalFramework",
  "academicContribution",
  "expectedResults",
  "limitations",
  "notes",
] as const;

export type AcademicReviewFieldKey = (typeof ACADEMIC_REVIEW_FIELDS)[number];

export type AcademicFieldReview = {
  observation: string;
  reviewedAt: string;
  reviewer: "ai" | "offline";
};

export type AcademicReviews = Partial<Record<AcademicReviewFieldKey, AcademicFieldReview>>;

export function parseAcademicReviews(json: string | null | undefined): AcademicReviews {
  if (!json?.trim()) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: AcademicReviews = {};
    for (const key of ACADEMIC_REVIEW_FIELDS) {
      const item = raw[key];
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.observation !== "string" || !row.observation.trim()) continue;
      out[key] = {
        observation: row.observation.trim(),
        reviewedAt: typeof row.reviewedAt === "string" ? row.reviewedAt : new Date().toISOString(),
        reviewer: row.reviewer === "offline" ? "offline" : "ai",
      };
    }
    return out;
  } catch {
    return {};
  }
}
