import "server-only";
import { prisma } from "@/lib/db";
import { embed } from "@/lib/ai/provider";
import { chunkText, cosineSimilarity } from "@/lib/ai/embeddings";
import { getAiConfig } from "@/lib/ai/config";
import { LOCAL_DIM } from "@/lib/ai/embeddings";

export const LIBRARY_SOURCE_TYPES = ["article"] as const;
export const WORK_SOURCE_TYPES = [
  "post",
  "comment",
  "task",
  "deliverable",
  "user",
  "project",
  "requirement",
  "academic",
] as const;

export type IngestInput = {
  sourceType: "article" | "post" | "comment" | "task" | "deliverable" | "user" | "project" | "requirement" | "academic";
  sourceId: string;
  projectId?: string | null;
  text: string;
  chunks?: string[];
};

async function embeddingMeta(vector: number[]) {
  const cfg = await getAiConfig();
  const usesProvider = cfg.provider === "openai" && Boolean(cfg.apiKey);
  return {
    modelName: usesProvider ? cfg.embeddingModel : "local",
    dimensions: vector.length || (usesProvider ? null : LOCAL_DIM),
  };
}

/** Chunk + embed + (re)store embeddings for a source. */
export async function ingest({ sourceType, sourceId, projectId, text, chunks: preChunks }: IngestInput) {
  await prisma.embedding.deleteMany({ where: { sourceType, sourceId } });
  const chunks = preChunks?.length ? preChunks : chunkText(text);
  if (chunks.length === 0) return;
  let meta: { modelName: string; dimensions: number | null } | null = null;
  for (const chunk of chunks) {
    const vector = await embed(chunk);
    meta = meta ?? await embeddingMeta(vector);
    await prisma.embedding.create({
      data: {
        sourceType,
        sourceId,
        projectId: projectId ?? null,
        chunk,
        vector: JSON.stringify(vector),
        modelName: meta.modelName,
        dimensions: vector.length || meta.dimensions,
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
  opts: {
    projectId?: string | null;
    limit?: number;
    sourceType?: string;
    sourceTypes?: string[];
    excludeSourceTypes?: string[];
    scanLimit?: number;
  } = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 6;
  const scanLimit = opts.scanLimit ?? 2000;
  const qVec = await embed(query);

  const sourceWhere = opts.sourceTypes?.length
    ? { sourceType: { in: opts.sourceTypes } }
    : opts.sourceType
      ? { sourceType: opts.sourceType }
      : opts.excludeSourceTypes?.length
        ? { sourceType: { notIn: opts.excludeSourceTypes } }
        : {};

  const rows = await prisma.embedding.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...sourceWhere,
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
