import "server-only";
import { aiEnabled, chat, type ChatMessage } from "@/lib/ai/provider";
import type { UserActivitySummary } from "@/plugins/reports/actions";
import {
  normalizeAiSections,
  type AiAnalysisSection,
  type AiNarrative,
} from "@/plugins/reports/ai-sections";
import { formatDate } from "@/lib/utils";

function briefFromSummary(data: UserActivitySummary): string {
  const lines: string[] = [];
  lines.push(`Pessoa: ${data.user.name} (${data.user.profilesLabel})`);
  lines.push(`Periodo: ${formatDate(data.period.from)} a ${formatDate(data.period.to)}`);
  lines.push(
    `KPIs: concluidas=${data.kpis.tasksCompleted}, andamento=${data.kpis.tasksInProgress}, entregaveis=${data.kpis.deliverablesSubmitted}, requisitos=${data.kpis.requirementsCreated}, forum=${data.kpis.forumPosts}, eventos=${data.kpis.totalEvents}`,
  );
  if (data.academic) {
    lines.push(
      `Academico: ${data.academic.program}/${data.academic.status}, disciplinas ${data.academic.coursesDone}/${data.academic.coursesTotal}, pendencias=${data.academic.pendingCount}`,
    );
  }
  lines.push("Tarefas:");
  for (const proj of data.tasksByProject) {
    for (const t of proj.tasks.slice(0, 20)) {
      lines.push(`- [${proj.projectKey}] ${t.title} (${t.status})${t.dueDate ? ` prazo ${formatDate(t.dueDate)}` : ""}`);
    }
  }
  if (data.deliverables.length) {
    lines.push("Entregaveis:");
    for (const d of data.deliverables.slice(0, 15)) {
      lines.push(`- [${d.projectKey}] ${d.name} (${d.status})`);
    }
  }
  if (data.timeline.length) {
    lines.push("Timeline recente:");
    for (const e of data.timeline.slice(0, 15)) {
      lines.push(`- ${formatDate(e.createdAt)} ${e.label}${e.projectKey ? ` [${e.projectKey}]` : ""}`);
    }
  }
  return lines.join("\n");
}

function factualFallback(data: UserActivitySummary, sections: AiAnalysisSection[]): AiNarrative {
  const out: AiNarrative = { aiUsed: false };
  if (sections.includes("executiveSummary")) {
    out.executiveSummary = [
      `Atividade de ${data.user.name} entre ${formatDate(data.period.from)} e ${formatDate(data.period.to)}.`,
      `${data.kpis.tasksCompleted} tarefas concluidas, ${data.kpis.tasksInProgress} em andamento, ${data.kpis.totalEvents} eventos registrados.`,
    ].join(" ");
  }
  if (sections.includes("highlights")) {
    const done = data.tasksByProject.flatMap((p) =>
      p.tasks.filter((t) => t.status === "done").map((t) => `- [${p.projectKey}] ${t.title}`),
    );
    out.highlights = done.slice(0, 8).join("\n") || "- Sem tarefas concluidas no recorte.";
  }
  if (sections.includes("pendenciesAndRisks")) {
    const open = data.tasksByProject.flatMap((p) =>
      p.tasks
        .filter((t) => t.status !== "done")
        .map((t) => `- [${p.projectKey}] ${t.title} (${t.status})`),
    );
    out.pendenciesAndRisks = open.slice(0, 10).join("\n") || "- Sem pendencias evidentes nas tarefas listadas.";
  }
  if (sections.includes("workflowImprovements")) {
    out.workflowImprovements = [
      "- Manter atualizacao frequente do status no Kanban.",
      "- Revisar prazos proximos ou vencidos.",
      "- Registrar bloqueios com comentario na tarefa.",
    ].join("\n");
  }
  if (sections.includes("otherSuggestions")) {
    out.otherSuggestions = [
      "- Priorizar itens em review ou in_progress.",
      data.academic?.pendingCount
        ? `- Acompanhar ${data.academic.pendingCount} pendencia(s) academica(s).`
        : "- Documentar decisoes relevantes na base de conhecimento.",
    ].join("\n");
  }
  return out;
}

function parseNarrative(raw: string, sections: AiAnalysisSection[], fallback: AiNarrative): AiNarrative {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const json = JSON.parse(cleaned) as Record<string, string>;
    const out: AiNarrative = { aiUsed: true };
    for (const key of sections) {
      const field = key === "highlights" ? "highlights" : key;
      const val = json[field] ?? json[key];
      if (typeof val === "string" && val.trim()) {
        (out as Record<string, unknown>)[key] = val.trim();
      } else if (fallback[key]) {
        (out as Record<string, unknown>)[key] = fallback[key];
      }
    }
    return out;
  } catch {
    return { ...fallback, aiUsed: true, executiveSummary: raw.slice(0, 1500) || fallback.executiveSummary };
  }
}

export async function generateActivityAiNarrative(
  data: UserActivitySummary,
  sectionsInput?: AiAnalysisSection[],
): Promise<AiNarrative> {
  const sections = normalizeAiSections(sectionsInput);
  if (sections.length === 0) return { aiUsed: false };

  const fallback = factualFallback(data, sections);
  if (!(await aiEnabled())) return fallback;

  const wanted = sections
    .map((s) => `"${s}": "texto em portugues"`)
    .join(", ");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Voce analisa atividade de um membro de laboratorio de pesquisa. Responda SOMENTE JSON valido, sem markdown. Texto em portugues do Brasil.",
    },
    {
      role: "user",
      content: `Gere analise apenas nas secoes pedidas.

DADOS:
${briefFromSummary(data)}

Responda SOMENTE com JSON contendo exatamente estas chaves: { ${wanted} }
Use bullets com "- " quando fizer lista. Seja especifico e acionavel.`,
    },
  ];

  try {
    const raw = await chat(messages);
    if (raw.includes("modo offline") || raw.includes("Nao ha provedor de IA")) return fallback;
    return parseNarrative(raw, sections, fallback);
  } catch (err) {
    console.error("[reports] activity AI failed", err);
    return fallback;
  }
}
