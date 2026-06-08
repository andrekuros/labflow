"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emit } from "@/lib/events";
import { search as ragSearch } from "@/lib/ai/rag";

export async function createArticle(input: { title: string; content: string; tags?: string; projectId?: string | null }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const a = await prisma.knowledgeArticle.create({
    data: {
      title: input.title,
      content: input.content,
      tags: input.tags ?? "",
      projectId: input.projectId || null,
      authorId: session.id,
    },
  });
  await emit({ type: "article.created", actorId: session.id, projectId: a.projectId, payload: { id: a.id, title: a.title, content: a.content } });
  revalidatePath("/knowledge");
  return a;
}

export async function updateArticle(input: { id: string; title: string; content: string; tags?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const a = await prisma.knowledgeArticle.update({
    where: { id: input.id },
    data: { title: input.title, content: input.content, tags: input.tags ?? "" },
  });
  await emit({ type: "article.updated", actorId: session.id, projectId: a.projectId, payload: { id: a.id, title: a.title, content: a.content } });
  revalidatePath("/knowledge");
  return a;
}

export type KnowledgeSearchResult = {
  articles: { id: string; title: string; snippet: string; score: number }[];
};

/** Hybrid search: semantic (embeddings/RAG) + keyword fallback over articles. */
export async function searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
  const q = query.trim();
  if (!q) return { articles: [] };

  const hits = await ragSearch(q, { limit: 10 });
  const articleHits = hits.filter((h) => h.sourceType === "article");

  // Map embedding hits back to articles, plus keyword matches.
  const byId = new Map<string, { score: number; snippet: string }>();
  for (const h of articleHits) {
    const cur = byId.get(h.sourceId);
    if (!cur || h.score > cur.score) byId.set(h.sourceId, { score: h.score, snippet: h.chunk });
  }

  const keyword = await prisma.knowledgeArticle.findMany({
    where: { OR: [{ title: { contains: q } }, { content: { contains: q } }, { tags: { contains: q } }] },
    take: 10,
  });
  for (const k of keyword) {
    if (!byId.has(k.id)) byId.set(k.id, { score: 0.15, snippet: k.content.slice(0, 160) });
  }

  const ids = [...byId.keys()];
  const articles = await prisma.knowledgeArticle.findMany({ where: { id: { in: ids } } });
  const map = new Map(articles.map((a) => [a.id, a]));

  return {
    articles: ids
      .map((id) => {
        const a = map.get(id);
        const meta = byId.get(id)!;
        return a ? { id: a.id, title: a.title, snippet: meta.snippet, score: meta.score } : null;
      })
      .filter(Boolean as unknown as (x: { id: string; title: string; snippet: string; score: number } | null) => x is { id: string; title: string; snippet: string; score: number })
      .sort((a, b) => b.score - a.score),
  };
}
