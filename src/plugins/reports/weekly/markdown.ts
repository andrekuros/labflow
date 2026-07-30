import type { WeeklyLabReportData } from "@/plugins/reports/weekly/data";
import type { WeeklyAiNarrative } from "@/plugins/reports/weekly/agent";
import { formatDate } from "@/lib/utils";

export function generateWeeklyReportMarkdown(
  data: WeeklyLabReportData,
  narrative: WeeklyAiNarrative,
): string {
  const lines: string[] = [];
  lines.push("# Relatorio do Laboratorio");
  lines.push(`**Periodo:** ${formatDate(data.period.from)} a ${formatDate(data.period.to)}`);
  lines.push(`**Gerado em:** ${formatDate(data.generatedAt)}`);
  lines.push(`**Analise:** ${narrative.aiUsed ? "com IA" : "resumo factual"}`);
  lines.push("");

  if (narrative.executiveSummary) {
    lines.push("## Resumo executivo");
    lines.push(narrative.executiveSummary);
    lines.push("");
  }

  lines.push("## Atividade da equipe");
  lines.push("| Membro | Perfil | Concluidas | Eventos | Ultima atividade |");
  lines.push("|--------|--------|------------|---------|------------------|");
  for (const m of data.team) {
    lines.push(
      `| ${m.name} | ${m.profilesLabel} | ${m.tasksCompleted} | ${m.totalEvents} | ${m.lastEventAt ? formatDate(m.lastEventAt) : "—"} |`,
    );
  }
  lines.push("");

  if (data.activityByType.length > 0) {
    lines.push("## Eventos por tipo");
    lines.push("| Tipo | Quantidade |");
    lines.push("|------|------------|");
    for (const a of data.activityByType.slice(0, 20)) {
      lines.push(`| ${a.label} | ${a.count} |`);
    }
    lines.push("");
  }

  lines.push("## Saude dos projetos");
  if (data.projects.length === 0) {
    lines.push("Nenhum projeto ativo.");
  } else {
    lines.push("| Projeto | Status | Total | Done | WIP | Review | Atraso |");
    lines.push("|---------|--------|-------|------|-----|--------|--------|");
    for (const p of data.projects) {
      lines.push(
        `| ${p.key} ${p.name} | ${p.status} | ${p.tasksTotal} | ${p.tasksDone} | ${p.tasksInProgress} | ${p.tasksReview} | ${p.tasksOverdue} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Pendencias principais");
  if (data.pendencies.length === 0) {
    lines.push("Nenhuma pendencia automatica encontrada.");
  } else {
    for (const p of data.pendencies.slice(0, 40)) {
      lines.push(
        `- **[${p.kind}]** ${p.title} — ${p.detail}${p.projectKey ? ` (${p.projectKey})` : ""}${p.owner ? ` · ${p.owner}` : ""}`,
      );
    }
  }
  lines.push("");

  if (narrative.memberHighlights) {
    lines.push("## Destaques");
    lines.push(narrative.memberHighlights);
    lines.push("");
  }
  if (narrative.pendenciesAndRisks) {
    lines.push("## Pendencias e riscos");
    lines.push(narrative.pendenciesAndRisks);
    lines.push("");
  }
  if (narrative.workflowImprovements) {
    lines.push("## Melhorias de fluxo");
    lines.push(narrative.workflowImprovements);
    lines.push("");
  }
  if (narrative.otherSuggestions) {
    lines.push("## Outras sugestoes");
    lines.push(narrative.otherSuggestions);
    lines.push("");
  }

  return lines.join("\n");
}
