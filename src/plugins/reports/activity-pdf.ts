import type { UserActivitySummary } from "@/plugins/reports/actions";
import type { AiNarrative } from "@/plugins/reports/ai-sections";
import {
  addPageFooters,
  createPdfDocument,
  drawBullets,
  drawParagraph,
  drawSectionTitle,
  drawTable,
  PDF_COLORS,
  PDF_CONTENT_WIDTH,
  PDF_MARGIN,
} from "@/plugins/reports/pdf-kit";
import { formatDate } from "@/lib/utils";

function statusLabel(s: string) {
  const map: Record<string, string> = {
    backlog: "Backlog",
    todo: "A fazer",
    in_progress: "Em andamento",
    review: "Revisao",
    done: "Concluida",
    pending: "Pendente",
    submitted: "Submetido",
    accepted: "Aceito",
    rejected: "Rejeitado",
  };
  return map[s] ?? s;
}

export async function generateActivityReportPdf(
  data: UserActivitySummary,
  narrative?: AiNarrative | null,
): Promise<Buffer> {
  const subtitle = `Relatorio de ${data.user.name}`;
  const { doc, layout, done } = createPdfDocument(subtitle);

  doc.font("Helvetica-Bold").fontSize(18).fillColor(PDF_COLORS.heading);
  doc.text("Relatorio de Atividades", PDF_MARGIN.left, doc.y, { width: PDF_CONTENT_WIDTH });
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted);
  doc.text(`${data.user.name} · ${data.user.profilesLabel}`, { width: PDF_CONTENT_WIDTH });
  doc.text(`${data.user.email}`, { width: PDF_CONTENT_WIDTH });
  doc.text(`Periodo: ${formatDate(data.period.from)} a ${formatDate(data.period.to)}`, {
    width: PDF_CONTENT_WIDTH,
  });
  if (narrative?.aiUsed) {
    doc.text("Inclui analise por IA", { width: PDF_CONTENT_WIDTH });
  }
  doc.moveDown(0.6);

  if (narrative?.executiveSummary) {
    drawSectionTitle(layout, "Resumo executivo");
    drawParagraph(layout, narrative.executiveSummary);
  }

  drawSectionTitle(layout, "Indicadores");
  drawTable(
    layout,
    [
      { header: "Indicador", width: 320 },
      { header: "Valor", width: 167, align: "right" },
    ],
    [
      ["Tarefas concluidas", String(data.kpis.tasksCompleted)],
      ["Tarefas em andamento", String(data.kpis.tasksInProgress)],
      ["Entregaveis no periodo", String(data.kpis.deliverablesSubmitted)],
      ["Requisitos criados", String(data.kpis.requirementsCreated)],
      ["Posts / topicos", String(data.kpis.forumPosts)],
      ["Total de eventos", String(data.kpis.totalEvents)],
    ],
  );

  if (data.tasksByProject.length > 0) {
    drawSectionTitle(layout, "Tarefas por projeto");
    for (const proj of data.tasksByProject) {
      drawParagraph(layout, `${proj.projectKey} — ${proj.projectName}`);
      drawTable(
        layout,
        [
          { header: "Tarefa", width: 250 },
          { header: "Status", width: 90 },
          { header: "Sprint", width: 90 },
          { header: "Prazo", width: 57, align: "right" },
        ],
        proj.tasks.map((t) => [
          t.title,
          statusLabel(t.status),
          t.sprintName ?? "—",
          t.dueDate ? formatDate(t.dueDate) : "—",
        ]),
      );
    }
  }

  if (data.deliverables.length > 0) {
    drawSectionTitle(layout, "Entregaveis");
    drawTable(
      layout,
      [
        { header: "Nome", width: 220 },
        { header: "Status", width: 90 },
        { header: "Projeto", width: 70 },
        { header: "Prazo", width: 107, align: "right" },
      ],
      data.deliverables.map((d) => [
        d.name,
        statusLabel(d.status),
        d.projectKey,
        d.dueDate ? formatDate(d.dueDate) : "—",
      ]),
    );
  }

  if (data.academic) {
    drawSectionTitle(layout, "Atividade academica");
    drawTable(
      layout,
      [
        { header: "Campo", width: 160 },
        { header: "Valor", width: 327 },
      ],
      [
        ["Programa", data.academic.program],
        ["Status", data.academic.status],
        ["Orientador", data.academic.advisorName || "Nao informado"],
        ["Objetivo", data.academic.objective || "Nao informado"],
        ["Disciplinas", `${data.academic.coursesDone}/${data.academic.coursesTotal}`],
        ["Pendencias", String(data.academic.pendingCount)],
      ],
    );
  }

  if (data.timeline.length > 0) {
    drawSectionTitle(layout, "Timeline");
    drawTable(
      layout,
      [
        { header: "Data", width: 90 },
        { header: "Evento", width: 300 },
        { header: "Projeto", width: 97 },
      ],
      data.timeline.slice(0, 40).map((ev) => [
        formatDate(ev.createdAt),
        ev.label,
        ev.projectKey ?? "—",
      ]),
    );
  }

  if (narrative?.highlights) {
    drawSectionTitle(layout, "Destaques (IA)");
    drawBullets(layout, narrative.highlights);
  }
  if (narrative?.pendenciesAndRisks) {
    drawSectionTitle(layout, "Pendencias e riscos (IA)");
    drawBullets(layout, narrative.pendenciesAndRisks);
  }
  if (narrative?.workflowImprovements) {
    drawSectionTitle(layout, "Melhorias de fluxo (IA)");
    drawBullets(layout, narrative.workflowImprovements);
  }
  if (narrative?.otherSuggestions) {
    drawSectionTitle(layout, "Outras sugestoes (IA)");
    drawBullets(layout, narrative.otherSuggestions);
  }

  addPageFooters(doc);
  doc.end();
  return done;
}
