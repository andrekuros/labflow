export type AiAnalysisSection =
  | "executiveSummary"
  | "highlights"
  | "pendenciesAndRisks"
  | "workflowImprovements"
  | "otherSuggestions";

export const AI_SECTION_OPTIONS: { key: AiAnalysisSection; label: string; hint: string }[] = [
  {
    key: "executiveSummary",
    label: "Resumo executivo",
    hint: "Panorama do periodo em 2–4 frases",
  },
  {
    key: "highlights",
    label: "Destaques",
    hint: "Pontos positivos e entregas relevantes",
  },
  {
    key: "pendenciesAndRisks",
    label: "Pendencias e riscos",
    hint: "Atrasos, bloqueios e riscos",
  },
  {
    key: "workflowImprovements",
    label: "Melhorias de fluxo",
    hint: "Sugestoes concretas de processo",
  },
  {
    key: "otherSuggestions",
    label: "Outras sugestoes",
    hint: "Carga, sprint, conhecimento",
  },
];

export type AiNarrative = {
  executiveSummary?: string;
  highlights?: string;
  pendenciesAndRisks?: string;
  workflowImprovements?: string;
  otherSuggestions?: string;
  aiUsed: boolean;
};

export function normalizeAiSections(sections?: AiAnalysisSection[] | null): AiAnalysisSection[] {
  if (!sections?.length) return [];
  const allowed = new Set(AI_SECTION_OPTIONS.map((o) => o.key));
  return [...new Set(sections.filter((s) => allowed.has(s)))];
}
