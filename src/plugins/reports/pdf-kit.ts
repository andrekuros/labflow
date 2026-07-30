import PDFDocument from "pdfkit";

export type PDFDoc = InstanceType<typeof PDFDocument>;

export const PDF_COLORS = {
  brand: "#4f46e5",
  heading: "#0f172a",
  subheading: "#334155",
  body: "#1e293b",
  muted: "#64748b",
  border: "#cbd5e1",
  headerBg: "#f1f5f9",
  altRow: "#f8fafc",
  white: "#ffffff",
};

export const PDF_MARGIN = { top: 56, bottom: 64, left: 48, right: 48 };
export const PDF_PAGE_WIDTH = 595.28;
export const PDF_PAGE_HEIGHT = 841.89;
export const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN.left - PDF_MARGIN.right;
export const PDF_CELL_PAD = 5;
export const PDF_TABLE_FONT = 8;
export const PDF_BODY_FONT = 9.5;
const FOOTER_Y = PDF_PAGE_HEIGHT - PDF_MARGIN.bottom + 18;

export type PdfTableColumn = {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
};

export type PdfLayout = {
  doc: PDFDoc;
  subtitle: string;
};

export function contentBottom() {
  return PDF_PAGE_HEIGHT - PDF_MARGIN.bottom;
}

export function setBodyStyle(doc: PDFDoc) {
  doc.font("Helvetica").fontSize(PDF_BODY_FONT).fillColor(PDF_COLORS.body);
}

export function drawPageChrome(doc: PDFDoc, subtitle: string) {
  doc.save();
  doc.strokeColor(PDF_COLORS.border).lineWidth(0.5);
  doc.moveTo(PDF_MARGIN.left, PDF_MARGIN.top - 14).lineTo(PDF_PAGE_WIDTH - PDF_MARGIN.right, PDF_MARGIN.top - 14).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF_COLORS.brand);
  doc.text("LabFlow", PDF_MARGIN.left, PDF_MARGIN.top - 28, { width: 100 });
  doc.font("Helvetica").fillColor(PDF_COLORS.muted);
  doc.text(subtitle, PDF_MARGIN.left + 100, PDF_MARGIN.top - 28, {
    width: PDF_CONTENT_WIDTH - 100,
    align: "right",
  });
  doc.restore();
  setBodyStyle(doc);
  doc.y = PDF_MARGIN.top;
}

export function ensureSpace(layout: PdfLayout, height: number) {
  if (layout.doc.y + height > contentBottom()) {
    layout.doc.addPage();
    drawPageChrome(layout.doc, layout.subtitle);
    return true;
  }
  return false;
}

export function drawSectionTitle(layout: PdfLayout, title: string) {
  ensureSpace(layout, 36);
  const doc = layout.doc;
  doc.moveDown(0.5);
  const y = doc.y;
  doc.save();
  doc.rect(PDF_MARGIN.left, y, 3, 16).fill(PDF_COLORS.brand);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(PDF_COLORS.heading);
  doc.text(title, PDF_MARGIN.left + 10, y + 1, { width: PDF_CONTENT_WIDTH - 10 });
  doc.y = y + 22;
  setBodyStyle(doc);
}

export function drawParagraph(layout: PdfLayout, text: string) {
  const doc = layout.doc;
  const cleaned = text.trim();
  if (!cleaned) return;
  ensureSpace(layout, 18);
  doc.font("Helvetica").fontSize(PDF_BODY_FONT).fillColor(PDF_COLORS.body);
  doc.text(cleaned, PDF_MARGIN.left, doc.y, {
    width: PDF_CONTENT_WIDTH,
    align: "left",
    lineGap: 2,
  });
  doc.moveDown(0.35);
  setBodyStyle(doc);
}

export function drawBullets(layout: PdfLayout, text: string) {
  const doc = layout.doc;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const content = line.replace(/^[-*•]\s*/, "");
    ensureSpace(layout, 16);
    doc.font("Helvetica").fontSize(PDF_BODY_FONT).fillColor(PDF_COLORS.body);
    doc.text(`•  ${content}`, PDF_MARGIN.left, doc.y, {
      width: PDF_CONTENT_WIDTH - 4,
      lineGap: 1,
    });
    doc.moveDown(0.12);
  }
  doc.moveDown(0.25);
}

function measureRow(doc: PDFDoc, cells: string[], columns: PdfTableColumn[]) {
  doc.font("Helvetica").fontSize(PDF_TABLE_FONT);
  let max = 20;
  cells.forEach((cell, i) => {
    const col = columns[i];
    if (!col) return;
    const w = Math.max(12, col.width - PDF_CELL_PAD * 2);
    const h = doc.heightOfString(cell || "—", {
      width: w,
      align: col.align ?? "left",
    });
    max = Math.max(max, h + PDF_CELL_PAD * 2);
  });
  return Math.min(max, 120);
}

export function drawTable(layout: PdfLayout, columns: PdfTableColumn[], rows: string[][]) {
  if (rows.length === 0) return;
  const doc = layout.doc;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  // Normalize widths to content width to avoid overflow
  const scale = totalWidth > 0 ? PDF_CONTENT_WIDTH / totalWidth : 1;
  const cols = columns.map((c) => ({ ...c, width: Math.floor(c.width * scale) }));
  const used = cols.reduce((s, c) => s + c.width, 0);
  if (cols.length > 0) cols[cols.length - 1].width += PDF_CONTENT_WIDTH - used;

  const drawHeader = (y: number) => {
    let x = PDF_MARGIN.left;
    doc.save();
    doc.font("Helvetica-Bold").fontSize(PDF_TABLE_FONT).fillColor(PDF_COLORS.heading);
    for (const col of cols) {
      doc.rect(x, y, col.width, 20).fillAndStroke(PDF_COLORS.headerBg, PDF_COLORS.border);
      doc.fillColor(PDF_COLORS.heading).text(col.header, x + PDF_CELL_PAD, y + 5, {
        width: col.width - PDF_CELL_PAD * 2,
        align: col.align ?? "left",
        lineBreak: false,
        ellipsis: true,
      });
      x += col.width;
    }
    doc.restore();
    return y + 20;
  };

  ensureSpace(layout, 44);
  let y = drawHeader(doc.y);

  rows.forEach((row, rowIndex) => {
    const cells = cols.map((_, i) => String(row[i] ?? "—"));
    const rowHeight = measureRow(doc, cells, cols);
    if (y + rowHeight > contentBottom()) {
      layout.doc.addPage();
      drawPageChrome(layout.doc, layout.subtitle);
      y = drawHeader(PDF_MARGIN.top);
    }

    let x = PDF_MARGIN.left;
    const bg = rowIndex % 2 === 1 ? PDF_COLORS.altRow : PDF_COLORS.white;
    doc.save();
    doc.font("Helvetica").fontSize(PDF_TABLE_FONT).fillColor(PDF_COLORS.body);
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      doc.rect(x, y, col.width, rowHeight).fillAndStroke(bg, PDF_COLORS.border);
      doc.fillColor(PDF_COLORS.body).text(cells[i], x + PDF_CELL_PAD, y + PDF_CELL_PAD, {
        width: col.width - PDF_CELL_PAD * 2,
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

export function addPageFooters(doc: PDFDoc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    const page = doc.switchToPage(pages.start + i);
    // O rodape fica abaixo da margem inferior; sem zerar a margem o pdfkit
    // trata o texto como overflow e adiciona uma pagina em branco.
    const bottomMargin = page.margins.bottom;
    page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted);
    doc.text(`Pagina ${i + 1} de ${pages.count}`, PDF_MARGIN.left, FOOTER_Y, {
      width: PDF_CONTENT_WIDTH,
      align: "center",
    });
    page.margins.bottom = bottomMargin;
  }
}

export function createPdfDocument(subtitle: string): {
  doc: PDFDoc;
  layout: PdfLayout;
  done: Promise<Buffer>;
} {
  const doc = new PDFDocument({
    size: "A4",
    margins: PDF_MARGIN,
    bufferPages: true,
    autoFirstPage: true,
  });
  const layout: PdfLayout = { doc, subtitle };
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  drawPageChrome(doc, subtitle);
  return { doc, layout, done };
}
