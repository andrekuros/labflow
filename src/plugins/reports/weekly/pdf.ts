import type { WeeklyLabReportData } from "@/plugins/reports/weekly/data";
import type { WeeklyAiNarrative } from "@/plugins/reports/weekly/agent";
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

export async function generateWeeklyReportPdf(
  data: WeeklyLabReportData,
  narrative: WeeklyAiNarrative,
): Promise<Buffer> {
  const { doc, layout, done } = createPdfDocument("Relatorio do laboratorio");

  doc.font("Helvetica-Bold").fontSize(18).fillColor(PDF_COLORS.heading);
  doc.text("Relatorio do Laboratorio", PDF_MARGIN.left, doc.y, { width: PDF_CONTENT_WIDTH });
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted);
  doc.text(`Periodo: ${formatDate(data.period.from)} a ${formatDate(data.period.to)}`, {
    width: PDF_CONTENT_WIDTH,
  });
  doc.text(
    `Gerado em: ${formatDate(data.generatedAt)}${narrative.aiUsed ? " · Analise com IA" : " · Resumo factual"}`,
    { width: PDF_CONTENT_WIDTH },
  );
  doc.moveDown(0.6);

  if (narrative.executiveSummary) {
    drawSectionTitle(layout, "1. Resumo executivo");
    drawParagraph(layout, narrative.executiveSummary);
  }

  drawSectionTitle(layout, "2. Atividade da equipe");
  drawTable(
    layout,
    [
      { header: "Membro", width: 130 },
      { header: "Perfil", width: 110 },
      { header: "Concluidas", width: 70, align: "center" },
      { header: "Eventos", width: 60, align: "center" },
      { header: "Ultima atividade", width: 117 },
    ],
    data.team.map((m) => [
      m.name,
      m.profilesLabel,
      String(m.tasksCompleted),
      String(m.totalEvents),
      m.lastEventAt ? formatDate(m.lastEventAt) : "—",
    ]),
  );

  if (data.activityByType.length > 0) {
    drawSectionTitle(layout, "3. Eventos por tipo");
    drawTable(
      layout,
      [
        { header: "Tipo", width: 360 },
        { header: "Qtd", width: 127, align: "right" },
      ],
      data.activityByType.slice(0, 25).map((a) => [a.label, String(a.count)]),
    );
  }

  drawSectionTitle(layout, "4. Saude dos projetos");
  if (data.projects.length === 0) {
    drawParagraph(layout, "Nenhum projeto ativo.");
  } else {
    drawTable(
      layout,
      [
        { header: "Projeto", width: 180 },
        { header: "Status", width: 70 },
        { header: "Total", width: 45, align: "center" },
        { header: "Done", width: 45, align: "center" },
        { header: "WIP", width: 45, align: "center" },
        { header: "Review", width: 50, align: "center" },
        { header: "Atraso", width: 52, align: "center" },
      ],
      data.projects.map((p) => [
        `${p.key} — ${p.name}`,
        p.status,
        String(p.tasksTotal),
        String(p.tasksDone),
        String(p.tasksInProgress),
        String(p.tasksReview),
        String(p.tasksOverdue),
      ]),
    );
  }

  drawSectionTitle(layout, "5. Pendencias principais");
  if (data.pendencies.length === 0) {
    drawParagraph(layout, "Nenhuma pendencia automatica encontrada.");
  } else {
    drawTable(
      layout,
      [
        { header: "Tipo", width: 70 },
        { header: "Item", width: 150 },
        { header: "Detalhe", width: 170 },
        { header: "Proj.", width: 50 },
        { header: "Resp.", width: 47 },
      ],
      data.pendencies.slice(0, 40).map((p) => [
        p.kind,
        p.title,
        p.detail,
        p.projectKey ?? "—",
        p.owner?.split(",")[0]?.trim() || "—",
      ]),
    );
  }

  if (narrative.memberHighlights) {
    drawSectionTitle(layout, "6. Destaques (IA)");
    drawBullets(layout, narrative.memberHighlights);
  }
  if (narrative.pendenciesAndRisks) {
    drawSectionTitle(layout, "7. Pendencias e riscos (IA)");
    drawBullets(layout, narrative.pendenciesAndRisks);
  }
  if (narrative.workflowImprovements) {
    drawSectionTitle(layout, "8. Melhorias de fluxo (IA)");
    drawBullets(layout, narrative.workflowImprovements);
  }
  if (narrative.otherSuggestions) {
    drawSectionTitle(layout, "9. Outras sugestoes (IA)");
    drawBullets(layout, narrative.otherSuggestions);
  }

  addPageFooters(doc);
  doc.end();
  return done;
}
