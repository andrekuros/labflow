import "server-only";
import { prisma } from "@/lib/db";
import { chat, aiEnabled, type ChatMessage } from "@/lib/ai/provider";
import type { SessionUser } from "@/lib/auth";
import { search, LIBRARY_SOURCE_TYPES, WORK_SOURCE_TYPES, type SearchHit } from "@/lib/ai/rag";
import { filterRagHitsForUser } from "@/lib/knowledge-access";
import { listAiTools } from "@/plugins/registry";
import { articleIngestText } from "@/lib/knowledge/files";
import { getPluginSettings } from "@/plugins/registry";

export type AgentSource = {
  type: string;
  id: string;
  title: string;
  score: number;
  href?: string;
  path?: string | null;
  corpus?: "library" | "workspace";
};
export type AgentAnswer = { answer: string; sources: AgentSource[]; aiEnabled: boolean };

function hrefFor(type: string, id: string): string {
  if (type === "article") return `/knowledge/${id}`;
  if (type === "post") return `/forum/${id}`;
  if (type === "task") return `/board`;
  if (type === "deliverable") return `/deliverables`;
  if (type === "requirement") return `/planning?tab=requirements`;
  if (type === "project") return `/projects/${id}`;
  return "#";
}

/** Resolve RAG hits to human-readable sources (title + link target). */
async function resolveSources(hits: SearchHit[], corpus: "library" | "workspace"): Promise<AgentSource[]> {
  const out: AgentSource[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.sourceType}:${h.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let title = h.chunk.slice(0, 60);
    let path: string | null = null;
    if (h.sourceType === "article") {
      const a = await prisma.knowledgeArticle.findUnique({ where: { id: h.sourceId } });
      if (a) {
        title = a.title;
        path = a.externalPath;
      }
    } else if (h.sourceType === "task") {
      const t = await prisma.task.findUnique({ where: { id: h.sourceId } });
      if (t) title = t.title;
    } else if (h.sourceType === "deliverable") {
      const d = await prisma.deliverable.findUnique({ where: { id: h.sourceId } });
      if (d) title = d.name;
    } else if (h.sourceType === "post") {
      const th = await prisma.thread.findUnique({ where: { id: h.sourceId } });
      if (th) title = th.title;
    } else if (h.sourceType === "project") {
      const p = await prisma.project.findUnique({ where: { id: h.sourceId } });
      if (p) title = `${p.key} — ${p.name}`;
    } else if (h.sourceType === "requirement") {
      const r = await prisma.requirement.findUnique({ where: { id: h.sourceId } });
      if (r) title = r.code ? `${r.code} — ${r.title}` : r.title;
    }
    out.push({
      type: h.sourceType,
      id: h.sourceId,
      title,
      score: h.score,
      href: hrefFor(h.sourceType, h.sourceId),
      path,
      corpus,
    });
  }
  return out;
}

function formatLibraryContext(hits: SearchHit[], sources: AgentSource[]): string {
  if (hits.length === 0) return "BIBLIOTECA: (nenhum documento relevante)";
  const byId = new Map(sources.map((s) => [`${s.type}:${s.id}`, s]));
  const lines = hits.map((h, i) => {
    const src = byId.get(`${h.sourceType}:${h.sourceId}`);
    const label = src ? `[${i + 1}] ${src.title}${src.path ? ` (${src.path})` : ""} ${src.href ?? ""}` : `[${i + 1}]`;
    return `${label}\n${h.chunk}`;
  });
  return "BIBLIOTECA (cite as fontes pelo numero):\n" + lines.join("\n\n");
}

/**
 * RAG-backed agent answer. Retrieves library docs and workspace entities separately.
 */
export async function askKnowledge(
  question: string,
  opts: { projectId?: string | null; instructions?: string; user?: SessionUser | null } = {},
): Promise<AgentAnswer> {
  const scanLimit = Number(getPluginSettings("knowledge").ragScanLimit ?? 2000);
  const [rawLibrary, rawWork] = await Promise.all([
    search(question, {
      projectId: opts.projectId,
      limit: 8,
      sourceTypes: [...LIBRARY_SOURCE_TYPES],
      scanLimit,
    }),
    search(question, {
      projectId: opts.projectId,
      limit: 4,
      sourceTypes: [...WORK_SOURCE_TYPES],
      scanLimit,
    }),
  ]);
  const libraryHits = await filterRagHitsForUser(rawLibrary, opts.user ?? null);
  const workHits = await filterRagHitsForUser(rawWork, opts.user ?? null);
  const librarySources = await resolveSources(libraryHits, "library");
  const workSources = await resolveSources(workHits, "workspace");
  const sources = [...librarySources, ...workSources];

  const workBlock = workHits.length
    ? "TRABALHO (tarefas, projetos, requisitos):\n" + workHits.map((h) => `- ${h.chunk}`).join("\n")
    : "TRABALHO: (nenhum trecho relevante)";

  const toolList = listAiTools();
  const toolsBlock = toolList.length
    ? "\n\nFERRAMENTAS DISPONIVEIS (via plugins): " + toolList.map((t) => t.name).join(", ")
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        (opts.instructions ??
          "Voce e o assistente do laboratorio de pesquisa. Responda em portugues, de forma objetiva e tecnica. Prefira a BIBLIOTECA para documentacao; use TRABALHO para status operacional. Cite fontes da biblioteca como [1], [2].") +
        toolsBlock,
    },
    { role: "system", content: formatLibraryContext(libraryHits, librarySources) },
    { role: "system", content: workBlock },
    { role: "user", content: question },
  ];

  const answer = await chat(messages);
  return { answer, sources, aiEnabled: await aiEnabled() };
}

export async function searchLibrary(
  query: string,
  user: SessionUser | null,
  opts: { limit?: number } = {},
): Promise<AgentSource[]> {
  const scanLimit = Number(getPluginSettings("knowledge").ragScanLimit ?? 2000);
  const hits = await filterRagHitsForUser(
    await search(query, {
      limit: opts.limit ?? 8,
      sourceTypes: [...LIBRARY_SOURCE_TYPES],
      scanLimit,
    }),
    user,
  );
  return resolveSources(hits, "library");
}

export async function askAboutDocument(
  article: { id: string; title: string; content: string; extractedText: string },
  question: string,
  _user: SessionUser,
): Promise<AgentAnswer> {
  const text = articleIngestText(article).slice(0, 14000);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Responda em portugues com base apenas no documento abaixo. Se a resposta nao estiver no texto, diga que nao consta.",
    },
    { role: "system", content: `DOCUMENTO: ${article.title}\n\n${text}` },
    { role: "user", content: question },
  ];
  const answer = await chat(messages);
  return {
    answer,
    sources: [
      {
        type: "article",
        id: article.id,
        title: article.title,
        score: 1,
        href: `/knowledge/${article.id}`,
        corpus: "library",
      },
    ],
    aiEnabled: await aiEnabled(),
  };
}
