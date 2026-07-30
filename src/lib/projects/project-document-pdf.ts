import PDFDocument from "pdfkit";
import type { ProjectReportConfig, ProjectReportData } from "@/lib/projects/project-document-types";
import { normalizeReportConfig } from "@/lib/projects/project-document-types";
import {
  filteredReportTasks,
  filterReportIds,
  isWbsIncluded,
  reportPriorityLabel,
  reportStatusLabel,
  wbsChildren,
  wbsRoots,
} from "@/lib/projects/project-document";
import { formatDate } from "@/lib/utils";

type PDFDoc = InstanceType<typeof PDFDocument>;

const COLORS = {
  brand: "#4f46e5",
  brandLight: "#eef2ff",
  heading: "#0f172a",
  subheading: "#334155",
  body: "#1e293b",
  muted: "#64748b",
  border: "#cbd5e1",
  headerBg: "#f1f5f9",
  altRow: "#f8fafc",
  white: "#ffffff",
};

const MARGIN = { top: 56, bottom: 64, left: 54, right: 54 };
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right;
const CELL_PAD = 5;
const TABLE_FONT = 8;
const BODY_FONT = 9.5;
const FOOTER_Y = PAGE_HEIGHT - MARGIN.bottom + 18;

type TableColumn = { header: string; width: number; align?: "left" | "center" | "right" };

type PdfLayout = {
  doc: PDFDoc;
  projectKey: string;
};

function contentBottom() {
  return PAGE_HEIGHT - MARGIN.bottom;
}

function startContentPage(layout: PdfLayout) {
  layout.doc.addPage();
  drawPageChrome(layout.doc, layout.projectKey);
}

function ensureSpace(layout: PdfLayout, height: number) {
  if (layout.doc.y + height > contentBottom()) {
    startContentPage(layout);
    return true;
  }
  return false;
}

function setBodyStyle(doc: PDFDoc) {
  doc.font("Helvetica").fontSize(BODY_FONT).fillColor(COLORS.body);
}

function drawPageChrome(doc: PDFDoc, projectKey: string) {
  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(MARGIN.left, MARGIN.top - 14).lineTo(PAGE_WIDTH - MARGIN.right, MARGIN.top - 14).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.brand);
  doc.text(projectKey, MARGIN.left, MARGIN.top - 28, { width: 120, align: "left" });
  doc.font("Helvetica").fillColor(COLORS.muted);
  doc.text("Documentacao do projeto", MARGIN.left + 120, MARGIN.top - 28, {
    width: CONTENT_WIDTH - 120,
    align: "right",
  });
  doc.restore();
  setBodyStyle(doc);
  doc.y = MARGIN.top;
}

function drawSectionTitle(layout: PdfLayout, title: string) {
  ensureSpace(layout, 48);
  const doc = layout.doc;
  doc.moveDown(0.8);
  const y = doc.y;
  doc.save();
  doc.rect(MARGIN.left, y, 4, 22).fill(COLORS.brand);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.heading);
  doc.text(title, MARGIN.left + 12, y + 2, { width: CONTENT_WIDTH - 12 });
  doc.y = y + 30;
  setBodyStyle(doc);
}

function drawSubsectionTitle(layout: PdfLayout, title: string, depth = 0) {
  ensureSpace(layout, 28);
  const doc = layout.doc;
  doc.moveDown(0.4);
  const indent = depth * 14;
  const size = Math.max(10, 12 - depth);
  doc.font("Helvetica-Bold").fontSize(size).fillColor(COLORS.subheading);
  doc.text(title, MARGIN.left + indent, doc.y, { width: CONTENT_WIDTH - indent });
  doc.moveDown(0.25);
  setBodyStyle(doc);
}

function drawParagraph(layout: PdfLayout, text: string, opts?: { indent?: number; muted?: boolean }) {
  const doc = layout.doc;
  const indent = opts?.indent ?? 0;
  ensureSpace(layout, 20);
  doc.font("Helvetica").fontSize(BODY_FONT).fillColor(opts?.muted ? COLORS.muted : COLORS.body);
  doc.text(text.trim(), MARGIN.left + indent, doc.y, {
    width: CONTENT_WIDTH - indent,
    align: "left",
    lineGap: 2,
  });
  doc.moveDown(0.35);
  setBodyStyle(doc);
}

function drawBullets(layout: PdfLayout, items: string[], indent = 0) {
  const doc = layout.doc;
  for (const item of items) {
    ensureSpace(layout, 18);
    doc.font("Helvetica").fontSize(BODY_FONT).fillColor(COLORS.body);
    doc.text(`•  ${item}`, MARGIN.left + indent, doc.y, {
      width: CONTENT_WIDTH - indent - 8,
      lineGap: 1,
    });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.2);
}

function measureRow(doc: PDFDoc, cells: string[], columns: TableColumn[]) {
  doc.font("Helvetica").fontSize(TABLE_FONT);
  let max = 22;
  cells.forEach((cell, i) => {
    const w = columns[i].width - CELL_PAD * 2;
    const h = doc.heightOfString(cell || "—", { width: w, align: columns[i].align ?? "left" });
    max = Math.max(max, h + CELL_PAD * 2);
  });
  return max;
}

function drawTable(layout: PdfLayout, columns: TableColumn[], rows: string[][]) {
  if (rows.length === 0) return;
  const doc = layout.doc;

  const drawHeader = (y: number) => {
    let x = MARGIN.left;
    doc.save();
    doc.font("Helvetica-Bold").fontSize(TABLE_FONT).fillColor(COLORS.heading);
    for (const col of columns) {
      doc.rect(x, y, col.width, 22).fillAndStroke(COLORS.headerBg, COLORS.border);
      doc.fillColor(COLORS.heading).text(col.header, x + CELL_PAD, y + 6, {
        width: col.width - CELL_PAD * 2,
        align: col.align ?? "left",
      });
      x += col.width;
    }
    doc.restore();
    return y + 22;
  };

  let y = doc.y;
  ensureSpace(layout, 40);
  y = drawHeader(y);

  rows.forEach((row, rowIndex) => {
    const rowHeight = measureRow(doc, row, columns);
    if (y + rowHeight > contentBottom()) {
      startContentPage(layout);
      y = drawHeader(MARGIN.top);
    }

    let x = MARGIN.left;
    const bg = rowIndex % 2 === 1 ? COLORS.altRow : COLORS.white;
    doc.save();
    doc.font("Helvetica").fontSize(TABLE_FONT).fillColor(COLORS.body);
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      doc.rect(x, y, col.width, rowHeight).fillAndStroke(bg, COLORS.border);
      doc.fillColor(COLORS.body).text(row[i] ?? "—", x + CELL_PAD, y + CELL_PAD, {
        width: col.width - CELL_PAD * 2,
        align: col.align ?? "left",
        lineGap: 1,
      });
      x += col.width;
    }
    doc.restore();
    y += rowHeight;
  });

  doc.y = y + 10;
  setBodyStyle(doc);
}

function drawCoverPage(doc: PDFDoc, data: ProjectReportData, generatedAt: Date) {
  const { project } = data;
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.white);

  doc.rect(0, 0, PAGE_WIDTH, 8).fill(COLORS.brand);
  doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8).fill(COLORS.brand);

  const blockTop = 220;
  doc.roundedRect(MARGIN.left, blockTop, CONTENT_WIDTH, 200, 8).fill(COLORS.brandLight);
  doc.roundedRect(MARGIN.left, blockTop, CONTENT_WIDTH, 200, 8).lineWidth(1).stroke(COLORS.border);

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.brand);
  doc.text(project.key, MARGIN.left + 24, blockTop + 28, { width: CONTENT_WIDTH - 48, align: "left" });

  doc.font("Helvetica-Bold").fontSize(26).fillColor(COLORS.heading);
  doc.text(project.name, MARGIN.left + 24, blockTop + 52, { width: CONTENT_WIDTH - 48, align: "left", lineGap: 4 });

  doc.font("Helvetica").fontSize(12).fillColor(COLORS.muted);
  doc.text("Documentacao consolidada do projeto", MARGIN.left + 24, blockTop + 130, {
    width: CONTENT_WIDTH - 48,
  });

  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted);
  doc.text(`Gerado em ${generatedAt.toLocaleString("pt-BR")}`, MARGIN.left + 24, blockTop + 156, {
    width: CONTENT_WIDTH - 48,
  });

  if (project.description?.trim()) {
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.body);
    doc.text(project.description.trim(), MARGIN.left, blockTop + 240, {
      width: CONTENT_WIDTH,
      align: "center",
      lineGap: 3,
    });
  }

  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted);
  doc.text("LabFlow — Gestao de Laboratorio de Pesquisa", MARGIN.left, PAGE_HEIGHT - 120, {
    width: CONTENT_WIDTH,
    align: "center",
  });

  doc.addPage();
  drawPageChrome(doc, project.key);
}

function drawFooters(doc: PDFDoc, projectKey: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start + 1; i < range.start + range.count; i++) {
    const page = doc.switchToPage(i);
    // O rodape fica abaixo da margem inferior; sem zerar a margem o pdfkit
    // trata o texto como overflow e adiciona uma pagina em branco.
    const bottomMargin = page.margins.bottom;
    page.margins.bottom = 0;
    doc.save();
    doc.strokeColor(COLORS.border).lineWidth(0.5);
    doc.moveTo(MARGIN.left, FOOTER_Y - 10).lineTo(PAGE_WIDTH - MARGIN.right, FOOTER_Y - 10).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
    doc.text(projectKey, MARGIN.left, FOOTER_Y, { width: 160, align: "left", lineBreak: false });
    doc.text("LabFlow", MARGIN.left, FOOTER_Y, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
    doc.text(`Pagina ${i} de ${range.count - 1}`, MARGIN.left, FOOTER_Y, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });
    doc.restore();
    page.margins.bottom = bottomMargin;
  }
}

function renderWbsNodePdf(
  layout: PdfLayout,
  node: ProjectReportData["workPackages"][number],
  data: ProjectReportData,
  config: ProjectReportConfig,
  tasks: ProjectReportData["tasks"],
  depth: number,
  sectionNum: string,
) {
  if (!isWbsIncluded(node.id, config, data.workPackages)) return;

  const code = node.code ? `${node.code} ` : "";
  drawSubsectionTitle(layout, `${sectionNum} ${code}${node.name}`, depth);

  const meta: string[] = [`Status: ${reportStatusLabel(node.status)}`];
  if (node.description?.trim()) meta.push(`Descricao: ${node.description.trim()}`);
  drawBullets(layout, meta, depth * 14 + 8);

  const nodeTasks = tasks.filter((t) => t.workPackageId === node.id);
  if (nodeTasks.length > 0) {
    drawParagraph(layout, "Tarefas vinculadas", { indent: depth * 14 + 8, muted: true });
    drawTable(
      layout,
      [
        { header: "Tarefa", width: CONTENT_WIDTH * 0.34 },
        { header: "Status", width: CONTENT_WIDTH * 0.14 },
        { header: "Prioridade", width: CONTENT_WIDTH * 0.14 },
        { header: "Responsaveis", width: CONTENT_WIDTH * 0.22 },
        { header: "Prazo", width: CONTENT_WIDTH * 0.16, align: "center" },
      ],
      nodeTasks.map((t) => [
        t.title,
        reportStatusLabel(t.status),
        reportPriorityLabel(t.priority),
        t.assignees,
        t.dueDate ? formatDate(t.dueDate) : "—",
      ]),
    );

    if (config.includeTaskDescriptions) {
      for (const t of nodeTasks.filter((x) => x.description?.trim())) {
        drawParagraph(layout, `${t.title}: ${t.description!.trim()}`, { indent: depth * 14 + 12, muted: true });
      }
    }
  }

  const children = wbsChildren(data.workPackages, node.id).filter((c) =>
    isWbsIncluded(c.id, config, data.workPackages),
  );
  children.forEach((child, i) => {
    renderWbsNodePdf(layout, child, data, config, tasks, depth + 1, `${sectionNum}.${i + 1}`);
  });
}

function renderOverview(
  layout: PdfLayout,
  data: ProjectReportData,
  counts: { tasks: number; deliverables: number; requirements: number },
) {
  const { project } = data;
  drawSectionTitle(layout, "1. Visao geral");
  drawBullets(layout, [
    `Sigla: ${project.key}`,
    `Status: ${reportStatusLabel(project.status)}`,
    ...(project.description?.trim() ? [`Descricao: ${project.description.trim()}`] : []),
    `Pacotes WBS: ${data.workPackages.length}`,
    `Entregaveis: ${counts.deliverables}`,
    `Requisitos: ${counts.requirements}`,
    `Tarefas no escopo: ${counts.tasks}`,
  ]);
}

function renderConops(layout: PdfLayout, conops: ProjectReportData["conops"]) {
  drawSectionTitle(layout, "2. CONOPS — Conceito de operacoes");
  const fields: [string, string][] = [
    ["Missao", conops.mission],
    ["Escopo", conops.scope],
    ["Stakeholders", conops.stakeholders],
    ["Ambiente operacional", conops.operatingEnvironment],
    ["Conceito de operacoes", conops.conceptOfOperations],
    ["Restricoes", conops.constraints],
    ["Criterios de sucesso", conops.successCriteria],
    ["Premissas", conops.assumptions],
  ];
  for (const [title, value] of fields) {
    if (!value?.trim()) continue;
    drawSubsectionTitle(layout, title);
    drawParagraph(layout, value);
  }
}

function renderTeam(layout: PdfLayout, members: ProjectReportData["members"]) {
  drawSectionTitle(layout, "3. Equipe do projeto");
  drawTable(
    layout,
    [
      { header: "Membro", width: CONTENT_WIDTH * 0.38 },
      { header: "Papel no projeto", width: CONTENT_WIDTH * 0.28 },
      { header: "Perfis", width: CONTENT_WIDTH * 0.34 },
    ],
    members.map((m) => [m.name, m.role, m.profilesLabel]),
  );
}

function renderWbs(
  layout: PdfLayout,
  data: ProjectReportData,
  config: ProjectReportConfig,
  tasks: ProjectReportData["tasks"],
) {
  drawSectionTitle(layout, "4. Estrutura analitica do trabalho (WBS)");
  drawParagraph(layout, "Hierarquia de atividades com tarefas alinhadas por pacote de trabalho.", { muted: true });

  const roots = wbsRoots(data.workPackages).filter((w) => isWbsIncluded(w.id, config, data.workPackages));
  roots.forEach((root, i) => renderWbsNodePdf(layout, root, data, config, tasks, 0, `4.${i + 1}`));

  const orphanTasks = tasks.filter((t) => !t.workPackageId);
  if (orphanTasks.length > 0) {
    drawSubsectionTitle(layout, "Tarefas sem pacote WBS");
    drawTable(
      layout,
      [
        { header: "Tarefa", width: CONTENT_WIDTH * 0.34 },
        { header: "Status", width: CONTENT_WIDTH * 0.16 },
        { header: "Prioridade", width: CONTENT_WIDTH * 0.16 },
        { header: "Responsaveis", width: CONTENT_WIDTH * 0.2 },
        { header: "Prazo", width: CONTENT_WIDTH * 0.14, align: "center" },
      ],
      orphanTasks.map((t) => [
        t.title,
        reportStatusLabel(t.status),
        reportPriorityLabel(t.priority),
        t.assignees,
        t.dueDate ? formatDate(t.dueDate) : "—",
      ]),
    );
  }
}

function renderDeliverables(layout: PdfLayout, deliverables: ProjectReportData["deliverables"]) {
  drawSectionTitle(layout, "5. Entregaveis");
  drawTable(
    layout,
    [
      { header: "Entregavel", width: CONTENT_WIDTH * 0.24 },
      { header: "WBS", width: CONTENT_WIDTH * 0.1, align: "center" },
      { header: "Status", width: CONTENT_WIDTH * 0.12 },
      { header: "Criterios de aceitacao", width: CONTENT_WIDTH * 0.36 },
      { header: "Prazo", width: CONTENT_WIDTH * 0.18, align: "center" },
    ],
    deliverables.map((d) => [
      d.name,
      d.workPackageCode ?? "—",
      reportStatusLabel(d.status),
      d.acceptance ?? "—",
      d.dueDate ? formatDate(d.dueDate) : "—",
    ]),
  );
}

function renderRequirements(layout: PdfLayout, requirements: ProjectReportData["requirements"]) {
  drawSectionTitle(layout, "6. Requisitos e objetivos");
  drawTable(
    layout,
    [
      { header: "Codigo", width: CONTENT_WIDTH * 0.12, align: "center" },
      { header: "Titulo", width: CONTENT_WIDTH * 0.34 },
      { header: "Tipo", width: CONTENT_WIDTH * 0.14 },
      { header: "Prioridade", width: CONTENT_WIDTH * 0.16 },
      { header: "Status", width: CONTENT_WIDTH * 0.24 },
    ],
    requirements.map((r) => [
      r.code ?? "—",
      r.title,
      r.kind,
      reportPriorityLabel(r.priority),
      reportStatusLabel(r.status),
    ]),
  );

  for (const r of requirements.filter((x) => x.description?.trim())) {
    drawSubsectionTitle(layout, `${r.code ? `${r.code} — ` : ""}${r.title}`);
    drawParagraph(layout, r.description!);
  }
}

function renderMilestones(layout: PdfLayout, milestones: ProjectReportData["milestones"]) {
  drawSectionTitle(layout, "7. Marcos e gates");
  drawTable(
    layout,
    [
      { header: "Marco", width: CONTENT_WIDTH * 0.36 },
      { header: "Data", width: CONTENT_WIDTH * 0.18, align: "center" },
      { header: "Gate", width: CONTENT_WIDTH * 0.2 },
      { header: "Status", width: CONTENT_WIDTH * 0.26 },
    ],
    milestones.map((m) => [
      m.name,
      m.date ? formatDate(m.date) : "—",
      m.gate ?? "—",
      reportStatusLabel(m.status),
    ]),
  );
}

function renderTasks(layout: PdfLayout, data: ProjectReportData, tasks: ProjectReportData["tasks"]) {
  drawSectionTitle(layout, "8. Plano de tarefas consolidado");
  drawTable(
    layout,
    [
      { header: "Tarefa", width: CONTENT_WIDTH * 0.22 },
      { header: "WBS", width: CONTENT_WIDTH * 0.14 },
      { header: "Status", width: CONTENT_WIDTH * 0.1 },
      { header: "Prior.", width: CONTENT_WIDTH * 0.08 },
      { header: "Est.", width: CONTENT_WIDTH * 0.07, align: "center" },
      { header: "Responsaveis", width: CONTENT_WIDTH * 0.16 },
      { header: "Sprint", width: CONTENT_WIDTH * 0.1 },
      { header: "Prazo", width: CONTENT_WIDTH * 0.13, align: "center" },
    ],
    tasks.map((t) => {
      const wp = data.workPackages.find((w) => w.id === t.workPackageId);
      const wbsLabel = wp ? `${wp.code ?? ""} ${wp.name}`.trim() : "—";
      return [
        t.title,
        wbsLabel,
        reportStatusLabel(t.status),
        reportPriorityLabel(t.priority),
        t.estimate != null ? `${t.estimate}h` : "—",
        t.assignees,
        t.sprintName ?? "—",
        t.dueDate ? formatDate(t.dueDate) : "—",
      ];
    }),
  );
}

function renderSprints(layout: PdfLayout, sprints: ProjectReportData["sprints"], tasks: ProjectReportData["tasks"]) {
  drawSectionTitle(layout, "9. Sprints");
  for (const s of sprints) {
    drawSubsectionTitle(layout, s.name);
    const lines = [`Status: ${reportStatusLabel(s.status)}`];
    if (s.startDate || s.endDate) {
      lines.push(`Periodo: ${s.startDate ? formatDate(s.startDate) : "?"} — ${s.endDate ? formatDate(s.endDate) : "?"}`);
    }
    if (s.goal?.trim()) lines.push(`Objetivo: ${s.goal.trim()}`);
    const sprintTasks = tasks.filter((t) => t.sprintName === s.name);
    if (sprintTasks.length > 0) lines.push(`Tarefas: ${sprintTasks.length}`);
    drawBullets(layout, lines, 8);
  }
}

function renderProjectDocumentPdf(
  doc: PDFDoc,
  data: ProjectReportData,
  configInput: ProjectReportConfig,
  generatedAt = new Date(),
) {
  const layout: PdfLayout = { doc, projectKey: data.project.key };
  const config = normalizeReportConfig(configInput);
  const tasks = filteredReportTasks(data, config);
  const deliverables = filterReportIds(data.deliverables, config.deliverableIds);
  const requirements = filterReportIds(data.requirements, config.requirementIds);
  const milestones = filterReportIds(data.milestones, config.milestoneIds);
  const sprints = filterReportIds(data.sprints, []);

  drawCoverPage(doc, data, generatedAt);

  if (config.sections.overview) {
    renderOverview(layout, data, {
      tasks: tasks.length,
      deliverables: deliverables.length,
      requirements: requirements.length,
    });
  }
  if (config.sections.conops) renderConops(layout, data.conops);
  if (config.sections.team && data.members.length > 0) renderTeam(layout, data.members);
  if (config.sections.wbs && data.workPackages.length > 0) renderWbs(layout, data, config, tasks);
  if (config.sections.deliverables && deliverables.length > 0) renderDeliverables(layout, deliverables);
  if (config.sections.requirements && requirements.length > 0) renderRequirements(layout, requirements);
  if (config.sections.milestones && milestones.length > 0) renderMilestones(layout, milestones);
  if (config.sections.tasks) renderTasks(layout, data, tasks);
  if (config.sections.sprints && sprints.length > 0) renderSprints(layout, sprints, tasks);

  ensureSpace(layout, 40);
  doc.moveDown(1);
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(MARGIN.left, doc.y).lineTo(PAGE_WIDTH - MARGIN.right, doc.y).stroke();
  doc.moveDown(0.6);
  drawParagraph(layout, `Documento gerado automaticamente pelo LabFlow para o projeto ${data.project.key}.`, {
    muted: true,
  });
}

export async function generateProjectDocumentPdf(
  data: ProjectReportData,
  configInput: ProjectReportConfig,
  _markdownOverride?: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
      bufferPages: true,
      info: {
        Title: `${data.project.key} — Documentacao`,
        Author: "LabFlow",
        Subject: `Documentacao do projeto ${data.project.name}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderProjectDocumentPdf(doc, data, configInput);
    drawFooters(doc, data.project.key);
    doc.end();
  });
}
