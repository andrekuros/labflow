export const LIBRARY_EXTENSIONS = ["md", "txt", "pdf", "docx", "xlsx", "xls", "pptx", "ppt"] as const;

export const LIBRARY_FILE_RE = /\.(md|txt|pdf|docx|xlsx|xls|pptx|ppt)$/i;
export const PAGE_FILE_RE = /\.(md|txt)$/i;
export const BINARY_FILE_RE = /\.(pdf|docx|xlsx|xls|pptx|ppt)$/i;

export const LIBRARY_ACCEPT = LIBRARY_EXTENSIONS.map((e) => `.${e}`).join(",");
export const LIBRARY_FORMATS_LABEL = LIBRARY_EXTENSIONS.map((e) => `.${e}`).join(", ");

export type ArticleKind = "page" | "file";

export function kindFromFileName(name: string): ArticleKind {
  return PAGE_FILE_RE.test(name) ? "page" : "file";
}

export function mimeFromFileName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  return "application/octet-stream";
}

export function titleFromFileName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(LIBRARY_FILE_RE, "").replace(/[-_]/g, " ").trim() || base;
}

export function slugifyFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "documento";
}

export function articleIngestText(article: {
  title: string;
  content?: string | null;
  extractedText?: string | null;
}): string {
  const body = (article.extractedText || article.content || "").trim();
  return [article.title, body].filter(Boolean).join("\n");
}

export const GENERATED_VAULT_PREFIX = "_labflow/generated";
export const LOCAL_VAULT_PREFIX = "_labflow/local";
