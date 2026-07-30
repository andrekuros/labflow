import { formatDate } from "@/lib/utils";
import type { UserActivitySummary } from "@/plugins/reports/actions";
import type { AiNarrative } from "@/plugins/reports/ai-sections";

export function generateReportMarkdown(
  data: UserActivitySummary,
  narrative?: AiNarrative | null,
): string {
  const lines: string[] = [];
  const fromStr = formatDate(data.period.from);
  const toStr = formatDate(data.period.to);

  lines.push(`# Relatorio de Atividades - ${data.user.name}`);
  lines.push(`**Periodo:** ${fromStr} a ${toStr}`);
  lines.push(`**Perfis:** ${data.user.profilesLabel}`);
  if (data.academic) {
    lines.push(`**Programa:** ${data.academic.program} (${data.academic.status})`);
  }
  if (narrative?.aiUsed) {
    lines.push(`**Analise:** com IA`);
  }
  lines.push("");

  if (narrative?.executiveSummary) {
    lines.push("## Resumo executivo");
    lines.push(narrative.executiveSummary);
    lines.push("");
  }

  lines.push("## Resumo");
  lines.push(`- Tarefas concluidas: ${data.kpis.tasksCompleted}`);
  lines.push(`- Tarefas em andamento: ${data.kpis.tasksInProgress}`);
  lines.push(`- Entregaveis submetidos: ${data.kpis.deliverablesSubmitted}`);
  lines.push(`- Requisitos criados: ${data.kpis.requirementsCreated}`);
  lines.push(`- Posts no forum: ${data.kpis.forumPosts}`);
  lines.push(`- Total de acoes: ${data.kpis.totalEvents}`);
  lines.push("");

  if (data.tasksByProject.length > 0) {
    lines.push("## Projetos");
    for (const proj of data.tasksByProject) {
      lines.push(`### ${proj.projectKey} - ${proj.projectName}`);
      lines.push("| Tarefa | Status | Sprint | Prazo |");
      lines.push("|--------|--------|--------|-------|");
      for (const t of proj.tasks) {
        lines.push(`| ${t.title} | ${t.status} | ${t.sprintName ?? "-"} | ${t.dueDate ? formatDate(t.dueDate) : "-"} |`);
      }
      lines.push("");
    }
  }

  if (data.deliverables.length > 0) {
    lines.push("## Entregaveis");
    lines.push("| Nome | Status | Projeto | Prazo |");
    lines.push("|------|--------|---------|-------|");
    for (const d of data.deliverables) {
      lines.push(`| ${d.name} | ${d.status} | ${d.projectKey} | ${d.dueDate ? formatDate(d.dueDate) : "-"} |`);
    }
    lines.push("");
  }

  if (data.academic) {
    lines.push("## Atividade Academica");
    lines.push(`- **Programa:** ${data.academic.program}`);
    lines.push(`- **Objetivo:** ${data.academic.objective || "Nao informado"}`);
    lines.push(`- **Orientador:** ${data.academic.advisorName || "Nao informado"}`);
    lines.push(`- **Disciplinas:** ${data.academic.coursesDone}/${data.academic.coursesTotal} concluidas`);
    lines.push(`- **Pendencias:** ${data.academic.pendingCount}`);
    lines.push("");
  }

  if (data.timeline.length > 0) {
    lines.push("## Timeline");
    for (const ev of data.timeline.slice(0, 30)) {
      lines.push(`- ${formatDate(ev.createdAt)} - ${ev.label}${ev.projectKey ? ` [${ev.projectKey}]` : ""}`);
    }
    lines.push("");
  }

  if (narrative?.highlights) {
    lines.push("## Destaques (IA)");
    lines.push(narrative.highlights);
    lines.push("");
  }
  if (narrative?.pendenciesAndRisks) {
    lines.push("## Pendencias e riscos (IA)");
    lines.push(narrative.pendenciesAndRisks);
    lines.push("");
  }
  if (narrative?.workflowImprovements) {
    lines.push("## Melhorias de fluxo (IA)");
    lines.push(narrative.workflowImprovements);
    lines.push("");
  }
  if (narrative?.otherSuggestions) {
    lines.push("## Outras sugestoes (IA)");
    lines.push(narrative.otherSuggestions);
    lines.push("");
  }

  return lines.join("\n");
}
