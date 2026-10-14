/** Repository controlled vocabularies — pure, shared client/server. */

export const RESOURCE_TYPES = [
  "article",
  "thesis",
  "dissertation",
  "dataset",
  "report",
  "presentation",
  "software",
  "protocol",
  "image",
  "standard",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  article: "Artigo",
  thesis: "Tese",
  dissertation: "Dissertacao",
  dataset: "Conjunto de dados",
  report: "Relatorio tecnico",
  presentation: "Apresentacao",
  software: "Software",
  protocol: "Protocolo / procedimento",
  image: "Imagem / figura",
  standard: "Norma / padrao",
  other: "Outro",
};

export function isResourceType(v: string): v is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(v);
}

export const RECORD_STATUSES = ["draft", "submitted", "published", "withdrawn"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "Rascunho",
  submitted: "Em revisao",
  published: "Publicado",
  withdrawn: "Retirado",
};

export const RECORD_STATUS_COLORS: Record<RecordStatus, string> = {
  draft: "#94a3b8",
  submitted: "#3b82f6",
  published: "#22c55e",
  withdrawn: "#ef4444",
};

export function isRecordStatus(v: string): v is RecordStatus {
  return (RECORD_STATUSES as readonly string[]).includes(v);
}

export const VISIBILITIES = ["public", "members", "admin"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Publico (qualquer usuario autenticado)",
  members: "Membros do laboratorio",
  admin: "Somente administradores",
};

export function isVisibility(v: string): v is Visibility {
  return (VISIBILITIES as readonly string[]).includes(v);
}

export const LICENSES = [
  { id: "cc-by-4.0", label: "CC BY 4.0" },
  { id: "cc-by-sa-4.0", label: "CC BY-SA 4.0" },
  { id: "cc-by-nc-4.0", label: "CC BY-NC 4.0" },
  { id: "cc-by-nc-nd-4.0", label: "CC BY-NC-ND 4.0" },
  { id: "cc0-1.0", label: "CC0 1.0 (dominio publico)" },
  { id: "mit", label: "MIT" },
  { id: "apache-2.0", label: "Apache 2.0" },
  { id: "gpl-3.0", label: "GPL 3.0" },
  { id: "proprietary", label: "Proprietario / uso interno" },
  { id: "all-rights-reserved", label: "Todos os direitos reservados" },
] as const;

export const LICENSE_LABELS: Record<string, string> = Object.fromEntries(
  LICENSES.map((l) => [l.id, l.label]),
);

export const LANGUAGES = [
  { id: "pt", label: "Portugues" },
  { id: "en", label: "Ingles" },
  { id: "es", label: "Espanhol" },
  { id: "fr", label: "Frances" },
  { id: "de", label: "Alemao" },
  { id: "other", label: "Outro" },
] as const;

export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.id, l.label]),
);

export const FILE_BUNDLES = ["primary", "supplement", "thumbnail", "license"] as const;
export type FileBundle = (typeof FILE_BUNDLES)[number];

export const FILE_BUNDLE_LABELS: Record<FileBundle, string> = {
  primary: "Documento principal",
  supplement: "Material suplementar",
  thumbnail: "Miniatura",
  license: "Licenca",
};

export type RecordAuthor = {
  name: string;
  affiliation?: string;
  orcid?: string;
  role?: string;
};

/** Defensive parse: authorsJson is a String column and may hold anything. */
export function parseAuthors(raw: string | null | undefined): RecordAuthor[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((a) => {
        if (typeof a === "string") return { name: a.trim() };
        if (a && typeof a === "object" && typeof (a as RecordAuthor).name === "string") {
          const o = a as RecordAuthor;
          return {
            name: o.name.trim(),
            affiliation: typeof o.affiliation === "string" ? o.affiliation : undefined,
            orcid: typeof o.orcid === "string" ? o.orcid : undefined,
            role: typeof o.role === "string" ? o.role : undefined,
          };
        }
        return null;
      })
      .filter((a): a is RecordAuthor => Boolean(a?.name));
  } catch {
    return [];
  }
}

export function parseSubjects(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))];
}

export function formatAuthors(authors: RecordAuthor[], max = 4): string {
  if (authors.length === 0) return "Sem autoria registrada";
  const names = authors.map((a) => a.name);
  if (names.length <= max) return names.join("; ");
  return `${names.slice(0, max).join("; ")} et al.`;
}

/** ABNT-ish citation. Good enough to copy into a paper and adjust. */
export function buildCitation(record: {
  title: string;
  authorsJson?: string | null;
  year?: number | null;
  venue?: string | null;
  publisher?: string | null;
  doi?: string | null;
  handle: string;
}): string {
  const authors = parseAuthors(record.authorsJson);
  const who =
    authors.length > 0
      ? authors
          .map((a) => {
            const parts = a.name.trim().split(/\s+/);
            if (parts.length === 1) return parts[0].toUpperCase();
            const last = parts.pop()!;
            return `${last.toUpperCase()}, ${parts.map((p) => `${p[0]}.`).join(" ")}`;
          })
          .join("; ")
      : "LABORATORIO";
  const bits = [
    `${who}. ${record.title}.`,
    record.venue ? `${record.venue}.` : null,
    record.publisher ? `${record.publisher},` : null,
    record.year ? `${record.year}.` : null,
    record.doi ? `DOI: ${record.doi}.` : null,
    `Handle: ${record.handle}.`,
  ].filter(Boolean);
  return bits.join(" ");
}
