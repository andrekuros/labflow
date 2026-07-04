import "server-only";
import { prisma } from "@/lib/db";
import { embed } from "@/lib/ai/provider";
import { chunkText, cosineSimilarity } from "@/lib/ai/embeddings";

export type IngestInput = {
  sourceType: "article" | "post" | "comment" | "task" | "deliverable" | "user" | "project" | "requirement" | "academic";
  sourceId: string;
  projectId?: string | null;
  text: string;
};

/** Chunk + embed + (re)store embeddings for a source. */
export async function ingest({ sourceType, sourceId, projectId, text }: IngestInput) {
  await prisma.embedding.deleteMany({ where: { sourceType, sourceId } });
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    const vector = await embed(chunk);
    await prisma.embedding.create({
      data: {
        sourceType,
        sourceId,
        projectId: projectId ?? null,
        chunk,
        vector: JSON.stringify(vector),
      },
    });
  }
}

export type SearchHit = {
  sourceType: string;
  sourceId: string;
  projectId: string | null;
  chunk: string;
  score: number;
};

/** Remove all embeddings for a source. */
export async function purge(sourceType: string, sourceId: string) {
  await prisma.embedding.deleteMany({ where: { sourceType, sourceId } });
}

/** Semantic search over the embedding store (in-app cosine similarity). */
export async function search(
  query: string,
  opts: { projectId?: string | null; limit?: number; sourceType?: string; scanLimit?: number } = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 6;
  const scanLimit = opts.scanLimit ?? 2000;
  const qVec = await embed(query);

  const rows = await prisma.embedding.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.sourceType ? { sourceType: opts.sourceType } : {}),
    },
    take: scanLimit,
    orderBy: { createdAt: "desc" },
  });

  const scored = rows.map((r) => {
    let vec: number[] = [];
    try {
      vec = JSON.parse(r.vector);
    } catch {
      vec = [];
    }
    return {
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      projectId: r.projectId,
      chunk: r.chunk,
      score: cosineSimilarity(qVec, vec),
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
