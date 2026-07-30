import PDFDocument from "pdfkit";
import type { WeeklyLabReportData } from "@/plugins/reports/weekly/data";
import type { WeeklyAiNarrative } from "@/plugins/reports/weekly/agent";
import { formatDate } from "@/lib/utils";

type PDFDoc = InstanceType<typeof PDFDocument>;

/** Landscape A4 */
const W = 841.89;
const H = 595.28;
const M = { top: 40, bottom: 36, left: 48, right: 48 };
const CW = W - M.left - M.right;

const C = {
  brand: "#4f46e5",
  brandSoft: "#eef2ff",
  heading: "#0f172a",
  body: "#1e293b",
  muted: "#64748b",
  border: "#cbd5e1",
  white: "#ffffff",
  card: "#f8fafc",
};

function bulletsFromText(text?: string, max = 5): string[] {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function truncate(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function drawFooter(doc: PDFDoc, page: number, total: number, periodLabel: string) {
  doc.font("Helvetica").fontSize(8).fillColor(C.muted);
  doc.text(periodLabel, M.left, H - M.bottom + 10, { width: CW / 2, align: "left" });
  doc.text(`${page} / ${total}`, M.left + CW / 2, H - M.bottom + 10, {
    width: CW / 2,
    align: "right",
  });
}

function newSlide(doc: PDFDoc, first: boolean) {
  if (!first) doc.addPage({ size: [W, H], margins: M });
  doc.rect(0, 0, W, 6).fill(C.brand);
  doc.rect(0, H - 6, W, 6).fill(C.brand);
}

function titleBlock(doc: PDFDoc, eyebrow: string, title: string, subtitle?: string) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(C.brand);
  doc.text(eyebrow.toUpperCase(), M.left, M.top + 8, { width: CW });
  doc.moveDown(0.25);
  doc.font("Helvetica-Bold").fontSize(26).fillColor(C.heading);
  doc.text(title, { width: CW, lineGap: 2 });
  if (subtitle) {
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(12).fillColor(C.muted);
    doc.text(subtitle, { width: CW });
  }
}

function kpiCards(
  doc: PDFDoc,
  items: { label: string; value: string }[],
  y: number,
) {
  const gap = 12;
  const cardW = (CW - gap * (items.length - 1)) / items.length;
  const cardH = 72;
  items.forEach((item, i) => {
    const x = M.left + i * (cardW + gap);
    doc.roundedRect(x, y, cardW, cardH, 8).fill(C.card);
    doc.roundedRect(x, y, cardW, cardH, 8).lineWidth(0.8).stroke(C.border);
    doc.font("Helvetica").fontSize(9).fillColor(C.muted);
    doc.text(item.label, x + 12, y + 14, { width: cardW - 24 });
    doc.font("Helvetica-Bold").fontSize(22).fillColor(C.heading);
    doc.text(item.value, x + 12, y + 34, { width: cardW - 24 });
  });
  return y + cardH + 18;
}

function drawBulletList(doc: PDFDoc, items: string[], startY: number, opts?: { maxWidth?: number; x?: number }) {
  let y = startY;
  const x = opts?.x ?? M.left;
  const width = opts?.maxWidth ?? CW;
  for (const item of items) {
    doc.font("Helvetica").fontSize(12).fillColor(C.body);
    const text = `•  ${truncate(item, 140)}`;
    const h = doc.heightOfString(text, { width, lineGap: 2 });
    if (y + h > H - M.bottom - 20) break;
    doc.text(text, x, y, { width, lineGap: 2 });
    y += h + 8;
  }
  return y;
}

/**
 * Concise landscape PDF presentation: cover, period insights,
 * one slide per project, one per member, closing insight slides.
 */
export async function generateLabPresentationPdf(
  data: WeeklyLabReportData,
  narrative: WeeklyAiNarrative,
  labName = "LabFlow",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [W, H],
      margins: M,
      bufferPages: true,
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const periodLabel = `${formatDate(data.period.from)} — ${formatDate(data.period.to)}`;
    const activeMembers = data.team.filter((m) => m.totalEvents > 0);
    const projects = [...data.projects].sort((a, b) => b.tasksOverdue - a.tasksOverdue || b.tasksTotal - a.tasksTotal);
    const members = [...data.team].sort((a, b) => b.totalEvents - a.totalEvents);

    // Estimate slides for footer numbering after content? We'll renumber at end.
    // Build content first, then stamp footers.

    // 1. Cover
    newSlide(doc, true);
    doc.roundedRect(M.left, 140, CW, 220, 12).fill(C.brandSoft);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(C.brand);
    doc.text(labName, M.left + 36, 168, { width: CW - 72 });
    doc.font("Helvetica-Bold").fontSize(32).fillColor(C.heading);
    doc.text("Apresentacao do periodo", M.left + 36, 196, { width: CW - 72, lineGap: 4 });
    doc.font("Helvetica").fontSize(14).fillColor(C.muted);
    doc.text(periodLabel, M.left + 36, 270, { width: CW - 72 });
    doc.text(
      `${projects.length} projetos · ${activeMembers.length}/${data.team.length} membros ativos · ${data.totalEvents} eventos`,
      M.left + 36,
      298,
      { width: CW - 72 },
    );

    // 2. Period overview KPIs
    newSlide(doc, false);
    titleBlock(doc, "Visao geral", "Insights do periodo", periodLabel);
    let y = doc.y + 16;
    y = kpiCards(doc, [
      { label: "Eventos", value: String(data.totalEvents) },
      { label: "Membros ativos", value: `${activeMembers.length}/${data.team.length}` },
      { label: "Projetos", value: String(projects.length) },
      { label: "Pendencias", value: String(data.pendencies.length) },
    ], y);
    const overviewBullets = [
      ...bulletsFromText(narrative.executiveSummary, 3),
      ...bulletsFromText(narrative.memberHighlights, 2),
    ].slice(0, 5);
    if (overviewBullets.length === 0) {
      overviewBullets.push(
        `${activeMembers.length} membros registraram atividade no periodo.`,
        `${data.pendencies.filter((p) => p.kind === "task" || p.kind === "deliverable").length} itens de tarefa/entregavel em risco.`,
        `${data.openFeedbackCount} feedbacks abertos.`,
      );
    }
    drawBulletList(doc, overviewBullets, y);

    // 3. Project slides
    for (const p of projects) {
      newSlide(doc, false);
      titleBlock(doc, "Projeto", `${p.key} — ${truncate(p.name, 48)}`, `Status: ${p.status}`);
      y = doc.y + 14;
      y = kpiCards(doc, [
        { label: "Total", value: String(p.tasksTotal) },
        { label: "Concluidas", value: String(p.tasksDone) },
        { label: "Em andamento", value: String(p.tasksInProgress) },
        { label: "Em atraso", value: String(p.tasksOverdue) },
      ], y);

      const related = data.pendencies
        .filter((x) => x.projectKey === p.key)
        .slice(0, 4)
        .map((x) => `${x.title}: ${x.detail}`);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(C.heading);
      doc.text("Pendencias deste projeto", M.left, y, { width: CW });
      y = doc.y + 8;
      if (related.length === 0) {
        doc.font("Helvetica").fontSize(12).fillColor(C.muted);
        doc.text("Nenhuma pendencia critica listada para este projeto.", M.left, y, { width: CW });
      } else {
        drawBulletList(doc, related, y);
      }
    }

    // 4. Member slides
    for (const m of members) {
      newSlide(doc, false);
      titleBlock(doc, "Integrante", m.name, m.profilesLabel);
      y = doc.y + 14;
      y = kpiCards(doc, [
        { label: "Eventos no periodo", value: String(m.totalEvents) },
        { label: "Tarefas concluidas", value: String(m.tasksCompleted) },
        { label: "Tarefas totais", value: String(m.tasksTotal) },
        {
          label: "Ultima atividade",
          value: m.lastEventAt ? formatDate(m.lastEventAt) : "—",
        },
      ], y);

      const owned = data.pendencies
        .filter((p) => p.owner?.includes(m.name))
        .slice(0, 3)
        .map((p) => `${p.title} (${p.kind})`);
      const notes: string[] = [];
      if (m.totalEvents === 0) notes.push("Sem atividade registrada neste periodo.");
      else if (m.tasksCompleted > 0) notes.push(`${m.tasksCompleted} tarefa(s) concluida(s) no periodo.`);
      if (owned.length) notes.push(...owned);
      else if (m.totalEvents > 0) notes.push("Sem pendencias atribuidas nas listas automaticas.");

      doc.font("Helvetica-Bold").fontSize(12).fillColor(C.heading);
      doc.text("Notas", M.left, y, { width: CW });
      drawBulletList(doc, notes.slice(0, 4), doc.y + 8);
    }

    // 5. Insights — risks
    const risks = bulletsFromText(narrative.pendenciesAndRisks, 6);
    if (risks.length > 0 || data.pendencies.length > 0) {
      newSlide(doc, false);
      titleBlock(doc, "Insights", "Pendencias e riscos", "Foco do periodo");
      const items =
        risks.length > 0
          ? risks
          : data.pendencies.slice(0, 6).map((p) => `${p.title} — ${p.detail}`);
      drawBulletList(doc, items, doc.y + 18);
    }

    // 6. Insights — recommendations
    const recs = [
      ...bulletsFromText(narrative.workflowImprovements, 4),
      ...bulletsFromText(narrative.otherSuggestions, 3),
    ].slice(0, 6);
    if (recs.length > 0) {
      newSlide(doc, false);
      titleBlock(doc, "Insights", "Recomendacoes", "Melhorias e proximos passos");
      drawBulletList(doc, recs, doc.y + 18);
    }

    // Footers
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, total, periodLabel);
    }

    doc.end();
  });
}
