import "server-only";
import { prisma } from "@/lib/db";
import { ingest, purge } from "@/lib/ai/rag";
import { formatAuthors, parseAuthors, parseSubjects, parseTags } from "@/lib/repository/vocab";

/**
 * RAG ingestion for repository records.
 *
 * `sourceType` is "repository_record", kept separate from "article" so the
 * assistant can search the repository alone, or both corpora together.
 */
export const REPOSITORY_SOURCE_TYPE = "repository_record";

/** The text the embedding index sees: metadata header + extracted file text. */
export function recordIngestText(record: {
  handle: string;
  title: string;
  subtitle: string | null;
  abstract: string;
  authorsJson: string;
  venue: string | null;
  publisher: string | null;
  year: number | null;
  doi: string | null;
  tags: string;
  subjectsJson: string;
  resourceType: string;
  fullText: string;
}): string {
  const authors = formatAuthors(parseAuthors(record.authorsJson), 12);
  const header = [
    record.title,
    record.subtitle,
    `Autores: ${authors}`,
    record.year ? `Ano: ${record.year}` : null,
    record.venue ? `Veiculo: ${record.venue}` : null,
    record.publisher ? `Editora: ${record.publisher}` : null,
    record.doi ? `DOI: ${record.doi}` : null,
    `Tipo: ${record.resourceType}`,
    `Handle: ${record.handle}`,
    parseTags(record.tags).length ? `Tags: ${parseTags(record.tags).join(", ")}` : null,
    parseSubjects(record.subjectsJson).length
      ? `Assuntos: ${parseSubjects(record.subjectsJson).join(", ")}`
      : null,
    record.abstract ? `Resumo: ${record.abstract}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [header, record.fullText].filter(Boolean).join("\n\n");
}

export async function indexRepositoryRecord(recordId: string): Promise<void> {
  const record = await prisma.repositoryRecord.findUnique({ where: { id: recordId } });
  if (!record) {
    await purge(REPOSITORY_SOURCE_TYPE, recordId);
    return;
  }

  // A withdrawn deposit must stop answering questions.
  if (record.status === "withdrawn") {
    await purge(REPOSITORY_SOURCE_TYPE, recordId);
    return;
  }

  await ingest({
    sourceType: REPOSITORY_SOURCE_TYPE,
    sourceId: record.id,
    projectId: record.projectId,
    text: recordIngestText(record),
  });
}

export async function purgeRepositoryRecord(recordId: string): Promise<void> {
  await purge(REPOSITORY_SOURCE_TYPE, recordId);
}

/** Re-ingest everything. Used by the admin reindex action. */
export async function reindexRepository(): Promise<{ indexed: number; skipped: number }> {
  const records = await prisma.repositoryRecord.findMany({ select: { id: true, status: true } });
  let indexed = 0;
  let skipped = 0;
  for (const r of records) {
    if (r.status === "withdrawn") {
      await purge(REPOSITORY_SOURCE_TYPE, r.id);
      skipped += 1;
      continue;
    }
    await indexRepositoryRecord(r.id);
    indexed += 1;
  }
  return { indexed, skipped };
}
