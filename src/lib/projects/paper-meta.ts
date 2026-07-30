/** Paper pipeline metadata stored on paper projects. */

export const PAPER_STATUSES = [
  "idea",
  "scoping",
  "drafting",
  "internal_review",
  "submitted",
  "under_review",
  "revision",
  "accepted",
  "published",
] as const;

export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const PAPER_STATUS_LABELS: Record<PaperStatus, string> = {
  idea: "Ideia",
  scoping: "Estruturacao de ideias",
  drafting: "Rascunho",
  internal_review: "Revisao interna",
  submitted: "Submetido",
  under_review: "Em revisao",
  revision: "Revisao autores",
  accepted: "Aceito",
  published: "Publicado",
};

export const PAPER_STATUS_COLORS: Record<PaperStatus, string> = {
  idea: "#94a3b8",
  scoping: "#818cf8",
  drafting: "#0ea5e9",
  internal_review: "#f59e0b",
  submitted: "#a855f7",
  under_review: "#ec4899",
  revision: "#f97316",
  accepted: "#10b981",
  published: "#22c55e",
};

export const VENUE_TYPES = ["journal", "conference", "preprint", "thesis_chapter", "other"] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  journal: "Revista",
  conference: "Conferencia",
  preprint: "Preprint",
  thesis_chapter: "Capitulo de tese",
  other: "Outro",
};

export type ProjectPaperMeta = {
  abstract: string;
  venue: string;
  venueType: VenueType | "";
  status: PaperStatus;
  targetDate: string | null;
  publishedAt: string | null;
  doi: string;
  externalEditorUrl: string;
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
  aiReviewsJson: string;
  aiReportJson: string;
  /** Legacy publication id after migration (idempotency). */
  migratedFromPublicationId?: string;
};

export const EMPTY_PAPER_META: ProjectPaperMeta = {
  abstract: "",
  venue: "",
  venueType: "",
  status: "idea",
  targetDate: null,
  publishedAt: null,
  doi: "",
  externalEditorUrl: "",
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
  aiReviewsJson: "{}",
  aiReportJson: "{}",
};

export function parsePaperMeta(raw: string | null | undefined): ProjectPaperMeta {
  if (!raw) return { ...EMPTY_PAPER_META };
  try {
    const p = JSON.parse(raw) as Partial<ProjectPaperMeta>;
    const status = PAPER_STATUSES.includes(p.status as PaperStatus)
      ? (p.status as PaperStatus)
      : "idea";
    return {
      ...EMPTY_PAPER_META,
      ...p,
      status,
      venueType: (VENUE_TYPES.includes(p.venueType as VenueType) ? p.venueType : "") as VenueType | "",
      targetDate: p.targetDate ?? null,
      publishedAt: p.publishedAt ?? null,
    };
  } catch {
    return { ...EMPTY_PAPER_META };
  }
}

export function serializePaperMeta(meta: ProjectPaperMeta): string {
  return JSON.stringify(meta);
}
