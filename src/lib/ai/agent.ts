import "server-only";
import { prisma } from "@/lib/db";
import { chat, aiEnabled, type ChatMessage } from "@/lib/ai/provider";
import type { SessionUser } from "@/lib/auth";
import { search, type SearchHit } from "@/lib/ai/rag";
import { filterRagHitsForUser } from "@/lib/knowledge-access";
import { listAiTools } from "@/plugins/registry";

export type AgentSource = { type: string; id: string; title: string; score: number };
export type AgentAnswer = { answer: string; sources: AgentSource[]; aiEnabled: boolean };

/** Resolve RAG hits to human-readable sources (title + link target). */
async function resolveSources(hits: SearchHit[]): Promise<AgentSource[]> {
  const out: AgentSource[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.sourceType}:${h.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let title = h.chunk.slice(0, 60);
    if (h.sourceType === "article") {
      const a = await prisma.knowledgeArticle.findUnique({ where: { id: h.sourceId } });
      if (a) title = a.title;
    } else if (h.sourceType === "task") {
      const t = await prisma.task.findUnique({ where: { id: h.sourceId } });
      if (t) title = t.title;
    } else if (h.sourceType === "deliverable") {
      const d = await prisma.deliverable.findUnique({ where: { id: h.sourceId } });
      if (d) title = d.name;
    } else if (h.sourceType === "post") {
      const th = await prisma.thread.findUnique({ where: { id: h.sourceId } });
      if (th) title = th.title;
    }
    out.push({ type: h.sourceType, id: h.sourceId, title, score: h.score });
  }
  return out;
}

/**
 * RAG-backed agent answer. Retrieves relevant context from the accumulated
 * knowledge store and asks the configured LLM (or the offline fallback).
 */
export async function askKnowledge(
  question: string,
  opts: { projectId?: string | null; instructions?: string; user?: SessionUser | null } = {},
): Promise<AgentAnswer> {
  const rawHits = await search(question, { projectId: opts.projectId, limit: 6 });
  const hits = await filterRagHitsForUser(rawHits, opts.user ?? null);
  const sources = await resolveSources(hits);

  const contextBlock = hits.length
    ? "CONTEXTO (conhecimento do laboratorio):\n" + hits.map((h) => `- ${h.chunk}`).join("\n")
    : "CONTEXTO: (nenhum trecho relevante encontrado)";

  const toolList = listAiTools();
  const toolsBlock = toolList.length
    ? "\n\nFERRAMENTAS DISPONIVEIS (via plugins): " + toolList.map((t) => t.name).join(", ")
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        (opts.instructions ??
          "Voce e o assistente do laboratorio de pesquisa. Responda em portugues, de forma objetiva e tecnica, baseando-se no contexto fornecido.") +
        toolsBlock,
    },
    { role: "system", content: contextBlock },
    { role: "user", content: question },
  ];

  const answer = await chat(messages);
  return { answer, sources, aiEnabled: await aiEnabled() };
}
