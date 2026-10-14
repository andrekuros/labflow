import "server-only";
import { prisma } from "@/lib/db";
import {
  chatComplete,
  aiEnabled,
  AiProviderError,
  type ChatMessage,
  type ChatUsage,
  type ToolSpec,
} from "@/lib/ai/provider";
import type { SessionUser } from "@/lib/auth";
import {
  searchGroups,
  search,
  LIBRARY_SOURCE_TYPES,
  REPOSITORY_SOURCE_TYPES,
  WORK_SOURCE_TYPES,
  type SearchHit,
} from "@/lib/ai/rag";
import { filterRagHitsForUser } from "@/lib/knowledge-access";
import { listAiTools } from "@/plugins/registry";
import type { AiTool } from "@/plugins/types";
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

export type AgentAnswer = {
  answer: string;
  sources: AgentSource[];
  aiEnabled: boolean;
  /** True when a provider was configured but the call failed and we fell back. */
  degraded?: boolean;
  /** Human-readable provider failure, shown to the user instead of being swallowed. */
  error?: string;
  /** Tools the model actually invoked, in order. */
  toolsUsed?: string[];
  usage?: ChatUsage;
};

/**
 * How many extra hits to retrieve before access filtering. Permissions used to
 * be applied to the already-truncated top-k, so a user without access to the
 * best matches ended up with a near-empty context instead of their own next-best
 * documents.
 */
const ACCESS_OVERFETCH = 4;

/** Turns of prior conversation replayed to the model. */
const MAX_HISTORY_MESSAGES = 8;

/**
 * Tool round trips allowed per question. Bounded so a model that keeps calling
 * tools cannot spin: each step is a full LLM call.
 */
const MAX_TOOL_STEPS = 4;

/** Guardrail on how much a single tool result can add to the context. */
const MAX_TOOL_RESULT_CHARS = 4000;

const BASE_INSTRUCTIONS =
  "Voce e o assistente do laboratorio de pesquisa. Responda em portugues, de forma objetiva e tecnica. " +
  "Prefira a BIBLIOTECA para documentacao; use TRABALHO para status operacional. " +
  "Cite fontes da biblioteca como [1], [2]. " +
  "Se o contexto fornecido nao responder a pergunta, diga explicitamente que a informacao nao consta na base " +
  "e sugira onde procurar. Nunca invente dados, numeros, nomes ou decisoes que nao estejam no contexto. " +
  "Use as ferramentas disponiveis quando precisar de dados que nao estao no contexto. " +
  "Ferramentas de proposta nao alteram nada sozinhas: elas criam um rascunho que uma pessoa revisa e aceita — " +
  "ao usar uma, diga ao usuario que o rascunho ficou pendente de revisao.";

function hrefFor(type: string, id: string): string {
  if (type === "article") return `/knowledge/${id}`;
  if (type === "repository_record") return `/repository/${id}`;
  if (type === "post") return `/forum/${id}`;
  if (type === "comment") return `/board`;
  if (type === "task") return `/board`;
  if (type === "deliverable") return `/deliverables`;
  if (type === "requirement") return `/planning?tab=requirements`;
  if (type === "project") return `/projects/${id}`;
  return "#";
}

/** Resolve RAG hits to human-readable sources (title + link target), one query per type. */
async function resolveSources(hits: SearchHit[], corpus: "library" | "workspace"): Promise<AgentSource[]> {
  const unique: SearchHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.sourceType}:${h.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
  }

  const idsByType = new Map<string, string[]>();
  for (const h of unique) {
    idsByType.set(h.sourceType, [...(idsByType.get(h.sourceType) ?? []), h.sourceId]);
  }
  const ids = (type: string) => idsByType.get(type) ?? [];

  const [articles, tasks, deliverables, threads, comments, projects, requirements, records] =
    await Promise.all([
    ids("article").length
      ? prisma.knowledgeArticle.findMany({
          where: { id: { in: ids("article") } },
          select: { id: true, title: true, externalPath: true },
        })
      : [],
    ids("task").length
      ? prisma.task.findMany({ where: { id: { in: ids("task") } }, select: { id: true, title: true } })
      : [],
    ids("deliverable").length
      ? prisma.deliverable.findMany({ where: { id: { in: ids("deliverable") } }, select: { id: true, name: true } })
      : [],
    ids("post").length
      ? prisma.thread.findMany({ where: { id: { in: ids("post") } }, select: { id: true, title: true } })
      : [],
    ids("comment").length
      ? prisma.comment.findMany({
          where: { id: { in: ids("comment") } },
          select: { id: true, task: { select: { title: true } } },
        })
      : [],
    ids("project").length
      ? prisma.project.findMany({ where: { id: { in: ids("project") } }, select: { id: true, key: true, name: true } })
      : [],
    ids("requirement").length
      ? prisma.requirement.findMany({
          where: { id: { in: ids("requirement") } },
          select: { id: true, code: true, title: true },
        })
      : [],
    ids("repository_record").length
      ? prisma.repositoryRecord.findMany({
          where: { id: { in: ids("repository_record") } },
          select: { id: true, title: true, handle: true, year: true },
        })
      : [],
  ]);

  const articleById = new Map(articles.map((a) => [a.id, a]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const deliverableById = new Map(deliverables.map((d) => [d.id, d]));
  const threadById = new Map(threads.map((t) => [t.id, t]));
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const requirementById = new Map(requirements.map((r) => [r.id, r]));
  const recordById = new Map(records.map((r) => [r.id, r]));

  return unique.map((h) => {
    let title = h.chunk.slice(0, 60);
    let path: string | null = null;

    if (h.sourceType === "article") {
      const a = articleById.get(h.sourceId);
      if (a) {
        title = a.title;
        path = a.externalPath;
      }
    } else if (h.sourceType === "task") {
      title = taskById.get(h.sourceId)?.title ?? title;
    } else if (h.sourceType === "deliverable") {
      title = deliverableById.get(h.sourceId)?.name ?? title;
    } else if (h.sourceType === "post") {
      title = threadById.get(h.sourceId)?.title ?? title;
    } else if (h.sourceType === "comment") {
      const taskTitle = commentById.get(h.sourceId)?.task?.title;
      if (taskTitle) title = `Comentario em: ${taskTitle}`;
    } else if (h.sourceType === "project") {
      const p = projectById.get(h.sourceId);
      if (p) title = `${p.key} — ${p.name}`;
    } else if (h.sourceType === "requirement") {
      const r = requirementById.get(h.sourceId);
      if (r) title = r.code ? `${r.code} — ${r.title}` : r.title;
    } else if (h.sourceType === "repository_record") {
      const r = recordById.get(h.sourceId);
      if (r) {
        title = r.year ? `${r.title} (${r.year})` : r.title;
        path = r.handle;
      }
    }

    return { type: h.sourceType, id: h.sourceId, title, score: h.score, href: hrefFor(h.sourceType, h.sourceId), path, corpus };
  });
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

/** Retrieve, apply access control, then truncate — in that order. */
async function retrieve(
  hits: SearchHit[],
  user: SessionUser | null,
  limit: number,
): Promise<SearchHit[]> {
  const allowed = await filterRagHitsForUser(hits, user);
  return allowed.slice(0, limit);
}

/**
 * RAG-backed agent answer. Retrieves library docs and workspace entities
 * separately, in a single pass over the embedding store.
 */
export async function askKnowledge(
  question: string,
  opts: {
    projectId?: string | null;
    instructions?: string;
    user?: SessionUser | null;
    /** Prior turns, oldest first. Enables follow-up questions. */
    history?: ChatMessage[];
  } = {},
): Promise<AgentAnswer> {
  const scanLimit = Number(getPluginSettings("knowledge").ragScanLimit ?? 0);
  const libraryLimit = 8;
  const workLimit = 4;

  const groups = await searchGroups(question, [
    {
      key: "library",
      projectId: opts.projectId,
      limit: libraryLimit * ACCESS_OVERFETCH,
      // The wiki and the institutional repository are one corpus for the reader:
      // both answer "what do we know", and citations link to whichever wins.
      sourceTypes: [...LIBRARY_SOURCE_TYPES, ...REPOSITORY_SOURCE_TYPES],
      scanLimit,
    },
    {
      key: "work",
      projectId: opts.projectId,
      limit: workLimit * ACCESS_OVERFETCH,
      sourceTypes: [...WORK_SOURCE_TYPES],
      scanLimit,
    },
  ]);

  const libraryHits = await retrieve(groups.library ?? [], opts.user ?? null, libraryLimit);
  const workHits = await retrieve(groups.work ?? [], opts.user ?? null, workLimit);
  const librarySources = await resolveSources(libraryHits, "library");
  const workSources = await resolveSources(workHits, "workspace");
  const sources = [...librarySources, ...workSources];

  const workBlock = workHits.length
    ? "TRABALHO (tarefas, projetos, requisitos):\n" + workHits.map((h) => `- ${h.chunk}`).join("\n")
    : "TRABALHO: (nenhum trecho relevante)";

  // Tools are only offered when someone is authenticated to own the action.
  const toolList = opts.user ? listAiTools() : [];
  const history = (opts.history ?? []).slice(-MAX_HISTORY_MESSAGES);

  const messages: ChatMessage[] = [
    { role: "system", content: (opts.instructions ?? BASE_INSTRUCTIONS) + describeTools(toolList) },
    { role: "system", content: formatLibraryContext(libraryHits, librarySources) },
    { role: "system", content: workBlock },
    ...history,
    { role: "user", content: question },
  ];

  const llmOn = await aiEnabled();

  try {
    const result = await runToolLoop(messages, toolList, opts.user ?? null);
    return {
      answer: result.content,
      sources,
      aiEnabled: llmOn,
      toolsUsed: result.toolsUsed,
      usage: result.usage,
    };
  } catch (err) {
    if (!(err instanceof AiProviderError)) throw err;

    // Provider configured but unreachable: say so, and still return what we found.
    const found = sources.length
      ? `\n\nEncontrei ${sources.length} trecho(s) relevante(s) na base — veja as fontes abaixo.`
      : "\n\nAlem disso, nao encontrei trechos relevantes na base para esta pergunta.";

    return {
      answer: `Nao consegui gerar a resposta: ${err.message}${found}`,
      sources,
      aiEnabled: llmOn,
      degraded: true,
      error: err.message,
    };
  }
}

function describeTools(tools: AiTool[]): string {
  if (tools.length === 0) return "";
  const lines = tools.map((t) => `- ${t.name} (${t.kind ?? "read"}): ${t.description}`);
  return "\n\nFERRAMENTAS DISPONIVEIS:\n" + lines.join("\n");
}

function toToolSpecs(tools: AiTool[]): ToolSpec[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    required: t.required,
  }));
}

type ToolLoopResult = { content: string; toolsUsed: string[]; usage?: ChatUsage };

/**
 * Ask the model, execute any tools it requests, and ask again until it answers.
 *
 * Previously the tool names were merely listed in the prompt with no way to
 * invoke them, so `manifest.aiTools` could never actually run. Execution is
 * bounded by `MAX_TOOL_STEPS`, and each tool authorizes itself against the
 * calling user.
 */
async function runToolLoop(
  messages: ChatMessage[],
  tools: AiTool[],
  user: SessionUser | null,
): Promise<ToolLoopResult> {
  const specs = toToolSpecs(tools);
  const byName = new Map(tools.map((t) => [t.name, t]));
  const toolsUsed: string[] = [];
  const conversation = [...messages];

  let promptTokens = 0;
  let completionTokens = 0;

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const result = await chatComplete(conversation, specs);
    promptTokens += result.usage?.promptTokens ?? 0;
    completionTokens += result.usage?.completionTokens ?? 0;

    if (result.toolCalls.length === 0) {
      return {
        content: result.content,
        toolsUsed,
        usage: { promptTokens, completionTokens },
      };
    }

    conversation.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      const tool = byName.get(call.name);
      let output: string;

      if (!tool) {
        output = `Erro: ferramenta "${call.name}" nao existe.`;
      } else if (!user) {
        output = "Erro: usuario nao autenticado.";
      } else {
        toolsUsed.push(tool.name);
        try {
          output = await tool.run(call.arguments, { userId: user.id, user });
        } catch (err) {
          // A failing tool is data for the model, not a crash for the user.
          output = `Erro ao executar ${tool.name}: ${err instanceof Error ? err.message : "falha desconhecida"}`;
        }
      }

      conversation.push({
        role: "tool",
        name: call.name,
        toolCallId: call.id,
        content: output.slice(0, MAX_TOOL_RESULT_CHARS),
      });
    }
  }

  // Out of steps: ask once more with tools withheld so it has to conclude.
  const final = await chatComplete(conversation, []);
  return {
    content: final.content,
    toolsUsed,
    usage: {
      promptTokens: promptTokens + (final.usage?.promptTokens ?? 0),
      completionTokens: completionTokens + (final.usage?.completionTokens ?? 0),
    },
  };
}

export async function searchLibrary(
  query: string,
  user: SessionUser | null,
  opts: { limit?: number } = {},
): Promise<AgentSource[]> {
  const scanLimit = Number(getPluginSettings("knowledge").ragScanLimit ?? 0);
  const limit = opts.limit ?? 8;
  const hits = await retrieve(
    await search(query, { limit: limit * ACCESS_OVERFETCH, sourceTypes: [...LIBRARY_SOURCE_TYPES], scanLimit }),
    user,
    limit,
  );
  return resolveSources(hits, "library");
}

export async function askAboutDocument(
  article: { id: string; title: string; content: string; extractedText: string },
  question: string,
  _user: SessionUser,
  opts: { history?: ChatMessage[] } = {},
): Promise<AgentAnswer> {
  const text = articleIngestText(article).slice(0, 14000);
  const source: AgentSource = {
    type: "article",
    id: article.id,
    title: article.title,
    score: 1,
    href: `/knowledge/${article.id}`,
    corpus: "library",
  };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Responda em portugues com base apenas no documento abaixo. Se a resposta nao estiver no texto, diga que nao consta.",
    },
    { role: "system", content: `DOCUMENTO: ${article.title}\n\n${text}` },
    ...(opts.history ?? []).slice(-MAX_HISTORY_MESSAGES),
    { role: "user", content: question },
  ];

  const llmOn = await aiEnabled();

  try {
    const result = await chatComplete(messages);
    return { answer: result.content, sources: [source], aiEnabled: llmOn, usage: result.usage };
  } catch (err) {
    if (!(err instanceof AiProviderError)) throw err;
    return {
      answer: `Nao consegui gerar a resposta: ${err.message}`,
      sources: [source],
      aiEnabled: llmOn,
      degraded: true,
      error: err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Institutional repository
// ---------------------------------------------------------------------------

const REPOSITORY_INSTRUCTIONS =
  "Voce responde perguntas sobre o REPOSITORIO de documentos do laboratorio. " +
  "Use apenas os trechos fornecidos. Cite cada fonte pelo numero, como [1]. " +
  "Quando a resposta nao estiver nos trechos, diga isso explicitamente e sugira termos de busca — " +
  "nunca invente autores, anos, numeros ou conclusoes.";

/** Semantic search restricted to repository deposits. */
export async function searchRepositoryDocs(
  query: string,
  user: SessionUser | null,
  opts: { limit?: number; recordIds?: string[] } = {},
): Promise<AgentSource[]> {
  const scanLimit = Number(getPluginSettings("knowledge").ragScanLimit ?? 0);
  const limit = opts.limit ?? 8;
  const allowed = opts.recordIds ? new Set(opts.recordIds) : null;

  let hits = await search(query, {
    limit: limit * ACCESS_OVERFETCH,
    sourceTypes: [...REPOSITORY_SOURCE_TYPES],
    scanLimit,
  });
  if (allowed) hits = hits.filter((h) => allowed.has(h.sourceId));

  return resolveSources(await retrieve(hits, user, limit), "library");
}

/**
 * Ask a question against the repository corpus.
 *
 * `recordIds` narrows the corpus to a pre-filtered set (a collection, a project,
 * the current search results), so "ask these 12 papers" is a real capability and
 * not a whole-repository guess.
 */
export async function askRepository(
  question: string,
  opts: {
    user?: SessionUser | null;
    recordIds?: string[];
    limit?: number;
    history?: ChatMessage[];
    scopeLabel?: string;
  } = {},
): Promise<AgentAnswer> {
  const scanLimit = Number(getPluginSettings("knowledge").ragScanLimit ?? 0);
  const limit = opts.limit ?? 8;
  const allowed = opts.recordIds ? new Set(opts.recordIds) : null;

  let raw = await search(question, {
    limit: limit * ACCESS_OVERFETCH,
    sourceTypes: [...REPOSITORY_SOURCE_TYPES],
    scanLimit,
  });
  if (allowed) raw = raw.filter((h) => allowed.has(h.sourceId));

  const hits = await retrieve(raw, opts.user ?? null, limit);
  const sources = await resolveSources(hits, "library");
  const llmOn = await aiEnabled();

  if (hits.length === 0) {
    return {
      answer:
        `Nao encontrei nada no repositorio${opts.scopeLabel ? ` (${opts.scopeLabel})` : ""} ` +
        "para esta pergunta. Tente outros termos, ou verifique se o documento ja foi depositado e indexado.",
      sources: [],
      aiEnabled: llmOn,
    };
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        REPOSITORY_INSTRUCTIONS +
        (opts.scopeLabel ? `\nEscopo da busca: ${opts.scopeLabel}.` : ""),
    },
    { role: "system", content: formatLibraryContext(hits, sources).replace("BIBLIOTECA", "REPOSITORIO") },
    ...(opts.history ?? []).slice(-MAX_HISTORY_MESSAGES),
    { role: "user", content: question },
  ];

  try {
    const result = await chatComplete(messages);
    return { answer: result.content, sources, aiEnabled: llmOn, usage: result.usage };
  } catch (err) {
    if (!(err instanceof AiProviderError)) throw err;
    return {
      answer:
        `Nao consegui gerar a resposta: ${err.message}\n\n` +
        `Encontrei ${sources.length} documento(s) relevante(s) — veja as fontes abaixo.`,
      sources,
      aiEnabled: llmOn,
      degraded: true,
      error: err.message,
    };
  }
}

/** Single-deposit Q&A: answers strictly from one record's own text. */
export async function askAboutRecord(
  record: { id: string; title: string; handle: string; abstract: string; fullText: string },
  question: string,
  opts: { history?: ChatMessage[] } = {},
): Promise<AgentAnswer> {
  const text = [record.abstract, record.fullText].filter(Boolean).join("\n\n").slice(0, 14000);
  const source: AgentSource = {
    type: "repository_record",
    id: record.id,
    title: record.title,
    score: 1,
    href: `/repository/${record.id}`,
    path: record.handle,
    corpus: "library",
  };
  const llmOn = await aiEnabled();

  if (!text.trim()) {
    return {
      answer:
        "Este deposito ainda nao tem texto extraido (o arquivo pode ser uma imagem ou um PDF digitalizado). " +
        "Sem texto nao consigo responder sobre o conteudo.",
      sources: [source],
      aiEnabled: llmOn,
    };
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Responda em portugues com base apenas no documento abaixo. " +
        "Se a resposta nao estiver no texto, diga que nao consta no documento.",
    },
    { role: "system", content: `DOCUMENTO: ${record.title} [${record.handle}]\n\n${text}` },
    ...(opts.history ?? []).slice(-MAX_HISTORY_MESSAGES),
    { role: "user", content: question },
  ];

  try {
    const result = await chatComplete(messages);
    return { answer: result.content, sources: [source], aiEnabled: llmOn, usage: result.usage };
  } catch (err) {
    if (!(err instanceof AiProviderError)) throw err;
    return {
      answer: `Nao consegui gerar a resposta: ${err.message}`,
      sources: [source],
      aiEnabled: llmOn,
      degraded: true,
      error: err.message,
    };
  }
}
