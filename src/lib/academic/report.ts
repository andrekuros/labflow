/** Relatório final da proposta acadêmica — compartilhado client/server. */

export type AcademicFinalReport = {
  markdown: string;
  generatedAt: string;
  reviewer: "ai" | "offline";
};

export function parseAcademicReport(json: string | null | undefined): AcademicFinalReport | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
    return {
      markdown: raw.markdown.trim(),
      generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
      reviewer: raw.reviewer === "offline" ? "offline" : "ai",
    };
  } catch {
    return null;
  }
}

export function serializeAcademicReport(report: AcademicFinalReport): string {
  return JSON.stringify(report);
}
