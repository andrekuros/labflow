import "server-only";
import mammoth from "mammoth";
import { chunkText } from "@/lib/ai/embeddings";
import { kindFromFileName, mimeFromFileName } from "@/lib/knowledge/files";

export type ExtractResult = {
  text: string;
  pages: string[];
  kind: "page" | "file";
  mimeType: string;
};

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pages: string[] }> {
  const { extractText } = await import("unpdf");
  const result = await extractText(bytes, { mergePages: false });
  const pages = (Array.isArray(result.text) ? result.text : [result.text])
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return { text: pages.join("\n\n"), pages };
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return (result.value ?? "").trim();
}

async function extractSpreadsheet(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name] ?? {});
    return csv.trim() ? `# ${name}\n${csv.trim()}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
}

async function extractPptx(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/i)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/i)?.[1] ?? 0);
      return na - nb;
    });
  const slides: string[] = [];
  for (const name of names) {
    const xml = await zip.files[name]?.async("string");
    if (!xml) continue;
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1] ?? ""));
    const joined = texts.join(" ").replace(/\s+/g, " ").trim();
    if (joined) slides.push(`Slide ${slides.length + 1}\n${joined}`);
  }
  return slides.join("\n\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Extract searchable text from a vault file. Markdown/txt are decoded as UTF-8. */
export async function extractLibraryFile(fileName: string, bytes: Uint8Array): Promise<ExtractResult> {
  const kind = kindFromFileName(fileName);
  const mimeType = mimeFromFileName(fileName);
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    try {
      const { text, pages } = await extractPdf(bytes);
      return { text, pages, kind, mimeType };
    } catch (err) {
      console.error("[knowledge] PDF extract failed", fileName, err);
      return { text: "", pages: [], kind, mimeType };
    }
  }

  if (lower.endsWith(".docx")) {
    try {
      const text = await extractDocx(bytes);
      return { text, pages: text ? [text] : [], kind, mimeType };
    } catch (err) {
      console.error("[knowledge] DOCX extract failed", fileName, err);
      return { text: "", pages: [], kind, mimeType };
    }
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    try {
      const text = await extractSpreadsheet(bytes);
      return { text, pages: text ? [text] : [], kind, mimeType };
    } catch (err) {
      console.error("[knowledge] spreadsheet extract failed", fileName, err);
      return { text: "", pages: [], kind, mimeType };
    }
  }

  if (lower.endsWith(".pptx")) {
    try {
      const text = await extractPptx(bytes);
      return { text, pages: text ? [text] : [], kind, mimeType };
    } catch (err) {
      console.error("[knowledge] PPTX extract failed", fileName, err);
      return { text: "", pages: [], kind, mimeType };
    }
  }

  if (lower.endsWith(".ppt")) {
    return { text: "", pages: [], kind, mimeType };
  }

  const text = decodeUtf8(bytes);
  return { text, pages: text.trim() ? [text] : [], kind, mimeType };
}

/** Page-aware chunks for PDFs; falls back to character windows. */
export function chunksFromExtract(extracted: ExtractResult, fallbackText: string): string[] {
  if (extracted.pages.length > 1) {
    const out: string[] = [];
    extracted.pages.forEach((page, i) => {
      const labeled = `Pagina ${i + 1}\n${page}`;
      out.push(...chunkText(labeled));
    });
    return out;
  }
  return chunkText(extracted.text || fallbackText);
}
