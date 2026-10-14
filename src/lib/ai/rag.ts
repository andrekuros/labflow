import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { embed, embedMany, currentEmbeddingModelName, embeddingRuntimeStatus } from "@/lib/ai/provider";
import { chunkText, cosineSimilarity, lexicalScore, tokenize } from "@/lib/ai/embeddings";
import { LOCAL_DIM } from "@/lib/ai/embeddings";

export const LIBRARY_SOURCE_TYPES = ["article"] as const;
/** Institutional repository deposits — searchable on their own or with the library. */
export const REPOSITORY_SOURCE_TYPES = ["repository_record"] as const;
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
  sourceType:
    | "article"
    | "repository_record"
    | "post"
    | "comment"
    | "task"
    | "deliverable"
    | "user"
    | "project"
    | "requirement"
    | "academic";
  sourceId: string;
  projectId?: string | null;
  text: string;
  chunks?: string[];
};

/** Rows read per database page while scoring. Keeps memory flat on large corpora. */
const SCAN_PAGE_SIZE = 500;

/** Embedding requests per batch during ingestion. */
const EMBED_BATCH_SIZE = 32;

/**
 * Weight of lexical overlap in the hybrid score. Pure vector search misses the
 * vocabulary a lab actually uses day to day: requirement codes, project keys,
 * instrument names, people. Lexical overlap recovers those.
 */
const LEXICAL_WEIGHT = 0.25;

/**
 * Hits scoring below this fraction of the best hit are dropped. A relative
 * cutoff works across embedding models, unlike an absolute threshold that would
 * need recalibration whenever the provider changes.
 */
const RELATIVE_SCORE_CUTOFF = 0.35;

/** Chunk + embed + (re)store embeddings for a source. */
export async function ingest({ sourceType, sourceId, projectId, text, chunks: preChunks }: IngestInput) {
  const chunks = preChunks?.length ? preChunks : chunkText(text);
  const contentHash = createHash("sha256").update(chunks.join("\u0000")).digest("hex");

  // Skip work when neither the content nor the embedding model changed. Events
  // fire on every save, and re-embedding identical text is pure cost — with a
  // real provider, the dominant cost of a Nextcloud re-sync.
  const existing = await prisma.embedding.findFirst({
    where: { sourceType, sourceId },
    select: { contentHash: true, modelName: true },
  });
  if (existing?.contentHash && existing.contentHash === contentHash) {
    const activeModel = await currentEmbeddingModelName();
    if (existing.modelName === activeModel) return;
  }

  await prisma.embedding.deleteMany({ where: { sourceType, sourceId } });
  if (chunks.length === 0) return;

  let modelName: string | null = null;

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedMany(batch);
    // Resolved after embedding: the provider may have downgraded to local
    // vectors, and the stored label has to match what was actually produced.
    modelName = modelName ?? (await currentEmbeddingModelName());
    await prisma.embedding.createMany({
      data: batch.map((chunk, j) => ({
        sourceType,
        sourceId,
        projectId: projectId ?? null,
        chunk,
        vector: JSON.stringify(vectors[j] ?? []),
        modelName,
        dimensions: vectors[j]?.length || LOCAL_DIM,
        contentHash,
      })),
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

export type SearchOptions = {
  projectId?: string | null;
  limit?: number;
  sourceType?: string;
  sourceTypes?: string[];
  excludeSourceTypes?: string[];
  /** Safety cap on rows scored. 0 or negative means "no cap". */
  scanLimit?: number;
};

/**
 * Where-clause selecting vectors comparable with the active model.
 *
 * Rows written before `modelName` existed hold local hashed vectors, so they
 * stay comparable while the local model is active. Excluding them outright
 * would hide part of the corpus on upgrade — the exact failure this guard is
 * meant to prevent.
 */
function modelWhere(modelName: string) {
  return modelName === "local" ? { OR: [{ modelName: "local" }, { modelName: null }] } : { modelName };
}

function sourceWhereClause(opts: SearchOptions) {
  if (opts.sourceTypes?.length) return { sourceType: { in: opts.sourceTypes } };
  if (opts.sourceType) return { sourceType: opts.sourceType };
  if (opts.excludeSourceTypes?.length) return { sourceType: { notIn: opts.excludeSourceTypes } };
  return {};
}

type Candidate = { id: string };

/**
 * Pick which rows to score when the corpus is larger than the scan cap.
 *
 * Scoring by recency (the previous behaviour) made everything past the cap
 * permanently unreachable — a knowledge base that silently forgets its oldest
 * documents. Selecting lexical matches first means old-but-relevant content
 * stays reachable, and recency only breaks ties.
 */
async function selectCandidates(
  query: string,
  where: Record<string, unknown>,
  cap: number,
): Promise<Candidate[] | null> {
  const total = await prisma.embedding.count({ where });
  if (cap <= 0 || total <= cap) return null; // scan everything

  const tokens = tokenize(query).slice(0, 8);
  const seen = new Set<string>();
  const picked: Candidate[] = [];

  if (tokens.length > 0) {
    const lexical = await prisma.embedding.findMany({
      where: { ...where, OR: tokens.map((t) => ({ chunk: { contains: t } })) },
      select: { id: true },
      take: cap,
      orderBy: { createdAt: "desc" },
    });
    for (const row of lexical) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      picked.push(row);
    }
  }

  if (picked.length < cap) {
    const recent = await prisma.embedding.findMany({
      where,
      select: { id: true },
      take: cap - picked.length,
      orderBy: { createdAt: "desc" },
    });
    for (const row of recent) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      picked.push(row);
    }
  }

  return picked;
}

/**
 * Semantic search over the embedding store (hybrid vector + lexical, scored in-app).
 *
 * Only vectors produced by the *current* embedding model are considered: cosine
 * similarity between different models is meaningless, and comparing across
 * dimensions silently scored every older vector as 0. Use `embeddingIndexStats`
 * to find vectors left behind by a provider change.
 */
export async function search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  return (await searchGroups(query, [{ key: "default", ...opts }])).default ?? [];
}

export type SearchGroup = SearchOptions & { key: string };

/**
 * Run several differently-scoped searches over one pass of the store.
 *
 * The assistant needs library documents and workspace entities ranked
 * separately; doing that as two `search()` calls embedded the same question
 * twice and walked the table twice.
 */
export async function searchGroups(
  query: string,
  groups: SearchGroup[],
): Promise<Record<string, SearchHit[]>> {
  const out: Record<string, SearchHit[]> = {};
  if (groups.length === 0) return out;

  const qVec = await embed(query);
  const qTokens = tokenize(query);
  const modelName = await currentEmbeddingModelName();

  for (const group of groups) {
    const limit = group.limit ?? 6;
    const cap = group.scanLimit ?? 0;
    const where: Record<string, unknown> = {
      ...(group.projectId ? { projectId: group.projectId } : {}),
      ...sourceWhereClause(group),
      ...modelWhere(modelName),
    };

    const candidates = await selectCandidates(query, where, cap);
    const scored: SearchHit[] = [];

    const consume = (rows: { sourceType: string; sourceId: string; projectId: string | null; chunk: string; vector: string }[]) => {
      for (const r of rows) {
        let vec: number[] = [];
        try {
          vec = JSON.parse(r.vector) as number[];
        } catch {
          continue;
        }
        const vector = cosineSimilarity(qVec, vec);
        const lexical = lexicalScore(qTokens, r.chunk);
        const score = (1 - LEXICAL_WEIGHT) * vector + LEXICAL_WEIGHT * lexical;
        if (score <= 0) continue;
        scored.push({
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          projectId: r.projectId,
          chunk: r.chunk,
          score,
        });
      }
    };

    if (candidates) {
      for (let i = 0; i < candidates.length; i += SCAN_PAGE_SIZE) {
        const ids = candidates.slice(i, i + SCAN_PAGE_SIZE).map((c) => c.id);
        consume(
          await prisma.embedding.findMany({
            where: { id: { in: ids } },
            select: { sourceType: true, sourceId: true, projectId: true, chunk: true, vector: true },
          }),
        );
      }
    } else {
      let cursor: string | undefined;
      for (;;) {
        const rows = await prisma.embedding.findMany({
          where,
          select: { id: true, sourceType: true, sourceId: true, projectId: true, chunk: true, vector: true },
          take: SCAN_PAGE_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: "asc" },
        });
        if (rows.length === 0) break;
        consume(rows);
        cursor = rows[rows.length - 1].id;
        if (rows.length < SCAN_PAGE_SIZE) break;
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0]?.score ?? 0;
    out[group.key] = scored
      .filter((s) => s.score >= best * RELATIVE_SCORE_CUTOFF)
      .slice(0, limit);
  }

  return out;
}

export type EmbeddingIndexStats = {
  currentModel: string;
  total: number;
  current: number;
  stale: number;
  byModel: { modelName: string; count: number; dimensions: number | null }[];
  /** Set when the configured embedding model was unusable and local vectors are in use. */
  degraded: boolean;
  degradedReason?: string;
};

/**
 * Health of the embedding store. `stale` counts vectors produced by a model
 * other than the one configured now — they are invisible to search until
 * reindexed.
 */
export async function embeddingIndexStats(): Promise<EmbeddingIndexStats> {
  // One cheap embedding first: a provider that cannot serve the configured
  // model only reveals itself when called, and reporting counts against a model
  // name the provider will never actually produce is worse than not reporting.
  await embed("labflow").catch(() => undefined);

  const currentModel = await currentEmbeddingModelName();
  const grouped = await prisma.embedding.groupBy({
    by: ["modelName", "dimensions"],
    _count: { _all: true },
  });

  const byModel = grouped.map((g) => ({
    modelName: g.modelName ?? "(desconhecido)",
    dimensions: g.dimensions,
    count: g._count._all,
  }));
  const isCurrent = (name: string) =>
    name === currentModel || (currentModel === "local" && name === "(desconhecido)");

  const total = byModel.reduce((s, g) => s + g.count, 0);
  const current = byModel.filter((g) => isCurrent(g.modelName)).reduce((s, g) => s + g.count, 0);

  const runtime = embeddingRuntimeStatus();
  return {
    currentModel,
    total,
    current,
    stale: total - current,
    byModel,
    degraded: runtime.degraded,
    degradedReason: runtime.reason,
  };
}
