import "server-only";
import { aiEnabled, chat, type ChatMessage } from "@/lib/ai/provider";
import type { WeeklyLabReportData } from "@/plugins/reports/weekly/data";
import {
  normalizeAiSections,
  type AiAnalysisSection,
} from "@/plugins/reports/ai-sections";
import { formatDate } from "@/lib/utils";

export type WeeklyAiNarrative = {
  executiveSummary?: string;
  memberHighlights?: string;
  pendenciesAndRisks?: string;
  workflowImprovements?: string;
  otherSuggestions?: string;
  aiUsed: boolean;
};

function buildMetricsBrief(data: WeeklyLabReportData): string {
  const lines: string[] = [];
  lines.push(`Periodo: ${formatDate(data.period.from)} a ${formatDate(data.period.to)}`);
  lines.push(`Total de eventos: ${data.totalEvents}`);
  lines.push(`Membros ativos no periodo: ${data.team.filter((m) => m.totalEvents > 0).length}/${data.team.length}`);
  lines.push(`Feedbacks abertos: ${data.openFeedbackCount}`);
  lines.push(`Pendencias listadas: ${data.pendencies.length}`);
  lines.push("");
  lines.push("Equipe:");
  for (const m of data.team) {
    lines.push(
      `- ${m.name} (${m.profilesLabel}): ${m.tasksCompleted} concluidas, ${m.totalEvents} eventos, ultimo=${m.lastEventAt ? formatDate(m.lastEventAt) : "nunca"}`,
    );
  }
  lines.push("");
  lines.push("Projetos:");
  for (const p of data.projects) {
    lines.push(
      `- ${p.key} ${p.name}: total=${p.tasksTotal} done=${p.tasksDone} wip=${p.tasksInProgress} review=${p.tasksReview} overdue=${p.tasksOverdue}`,
    );
  }
  lines.push("");
  lines.push("Pendencias:");
  for (const p of data.pendencies.slice(0, 25)) {
    lines.push(`- [${p.kind}] ${p.title} | ${p.detail}${p.projectKey ? ` | ${p.projectKey}` : ""}`);
  }
  return lines.join("\n");
}

function factualFallback(data: WeeklyLabReportData, sections: AiAnalysisSection[]): WeeklyAiNarrative {
  const active = data.team.filter((m) => m.totalEvents > 0);
  const top = [...active].sort((a, b) => b.totalEvents - a.totalEvents).slice(0, 5);
  const out: WeeklyAiNarrative = { aiUsed: false };

  if (sections.includes("executiveSummary")) {
    out.executiveSummary = [
      `Relatorio factual (${formatDate(data.period.from)} a ${formatDate(data.period.to)}).`,
      `${data.totalEvents} eventos por ${active.length}/${data.team.length} membros.`,
      `${data.pendencies.length} pendencias automaticas; ${data.openFeedbackCount} feedbacks abertos.`,
    ].join(" ");
  }
  if (sections.includes("highlights")) {
    out.memberHighlights =
      top.length === 0
        ? "Nenhum membro registrou atividade no periodo."
        : top.map((m) => `- ${m.name}: ${m.totalEvents} eventos, ${m.tasksCompleted} concluidas.`).join("\n");
  }
  if (sections.includes("pendenciesAndRisks")) {
    out.pendenciesAndRisks =
      data.pendencies.length === 0
        ? "Nenhuma pendencia critica identificada."
        : data.pendencies
            .slice(0, 12)
            .map((p) => `- ${p.title}: ${p.detail}${p.projectKey ? ` (${p.projectKey})` : ""}`)
            .join("\n");
  }
  if (sections.includes("workflowImprovements")) {
    out.workflowImprovements = [
      "- Revisar tarefas em review/in_progress sem atualizacao recente.",
      "- Priorizar itens com prazo vencido.",
      "- Confirmar assignees em tarefas sem responsavel.",
    ].join("\n");
  }
  if (sections.includes("otherSuggestions")) {
    out.otherSuggestions = [
      "- Equilibrar carga se poucos membros concentram eventos.",
      "- Usar sprints curtos para itens parados.",
      data.inactiveMembers.length > 0
        ? `- Checar engajamento: ${data.inactiveMembers.map((m) => m.name).join(", ")}.`
        : "- Manter ritmo de atualizacao no Kanban.",
    ].join("\n");
  }
  return out;
}

function parseNarrative(
  raw: string,
  sections: AiAnalysisSection[],
  fallback: WeeklyAiNarrative,
): WeeklyAiNarrative {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const json = JSON.parse(cleaned) as Record<string, string>;
    const out: WeeklyAiNarrative = { aiUsed: true };
    if (sections.includes("executiveSummary")) {
      out.executiveSummary = json.executiveSummary || fallback.executiveSummary;
    }
    if (sections.includes("highlights")) {
      out.memberHighlights = json.memberHighlights || json.highlights || fallback.memberHighlights;
    }
    if (sections.includes("pendenciesAndRisks")) {
      out.pendenciesAndRisks = json.pendenciesAndRisks || fallback.pendenciesAndRisks;
    }
    if (sections.includes("workflowImprovements")) {
      out.workflowImprovements = json.workflowImprovements || fallback.workflowImprovements;
    }
    if (sections.includes("otherSuggestions")) {
      out.otherSuggestions = json.otherSuggestions || fallback.otherSuggestions;
    }
    return out;
  } catch {
    return { ...fallback, aiUsed: true, executiveSummary: raw.slice(0, 2000) || fallback.executiveSummary };
  }
}

export async function generateWeeklyNarrative(
  data: WeeklyLabReportData,
  sectionsInput?: AiAnalysisSection[],
): Promise<WeeklyAiNarrative> {
  const sections = normalizeAiSections(
    sectionsInput?.length
      ? sectionsInput
      : [
          "executiveSummary",
          "highlights",
          "pendenciesAndRisks",
          "workflowImprovements",
          "otherSuggestions",
        ],
  );
  const fallback = factualFallback(data, sections);
  if (sections.length === 0) return { aiUsed: false };
  if (!(await aiEnabled())) return fallback;

  const keys = sections
    .map((s) => (s === "highlights" ? "memberHighlights" : s))
    .map((k) => `"${k}": "..."`)
    .join(", ");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Voce e um coordenador de laboratorio de pesquisa. Responda SOMENTE com JSON valido. Texto em portugues do Brasil.",
    },
    {
      role: "user",
      content: `Analise os dados e gere apenas as secoes pedidas.

DADOS:
${buildMetricsBrief(data)}

Responda SOMENTE com JSON: { ${keys} }
Use bullets com "- " em listas. Seja especifico.`,
    },
  ];

  try {
    const raw = await chat(messages);
    if (raw.includes("modo offline") || raw.includes("Nao ha provedor de IA")) return fallback;
    return parseNarrative(raw, sections, fallback);
  } catch (err) {
    console.error("[weekly-report] AI narrative failed", err);
    return fallback;
  }
}
