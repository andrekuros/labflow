"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { askKnowledge, type AgentAnswer } from "@/lib/ai/agent";
import { requireAdmin } from "@/lib/rbac";
import type { ChatMessage } from "@/lib/ai/provider";
import { listAiTools } from "@/plugins/registry";

/** Turns of prior conversation accepted from the client. */
const MAX_HISTORY = 8;

export async function askAssistant(input: {
  question: string;
  agentKey?: string;
  /** Prior turns, oldest first, so follow-up questions resolve their referents. */
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<AgentAnswer> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const agent = input.agentKey
    ? await prisma.agentConfig.findUnique({ where: { key: input.agentKey } })
    : null;

  const history: ChatMessage[] = (input.history ?? [])
    .slice(-MAX_HISTORY)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const startedAt = Date.now();
  let result: AgentAnswer;
  try {
    result = await askKnowledge(input.question, {
      instructions: agent?.instructions,
      user: session,
      history,
    });
  } catch (err) {
    // Record the failure before rethrowing: an assistant that only logs its
    // successes cannot be debugged.
    if (agent) {
      await prisma.agentRun
        .create({
          data: {
            agentId: agent.id,
            userId: session.id,
            input: input.question,
            output: "",
            status: "error",
            latencyMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
    }
    throw err;
  }

  if (agent) {
    await prisma.agentRun
      .create({
        data: {
          agentId: agent.id,
          userId: session.id,
          input: input.question,
          output: result.answer,
          status: result.degraded ? "error" : "done",
          latencyMs: Date.now() - startedAt,
          promptTokens: result.usage?.promptTokens ?? null,
          completionTokens: result.usage?.completionTokens ?? null,
          toolsUsed: result.toolsUsed?.length ? JSON.stringify(result.toolsUsed) : null,
          error: result.error ?? null,
        },
      })
      .catch(() => {});
  }

  return result;
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const tool = listAiTools().find((t) => t.name === name);
  if (!tool) throw new Error(`Ferramenta nao encontrada: ${name}`);
  return tool.run(args, { userId: session.id });
}

export type AgentRunRow = {
  id: string;
  agentName: string;
  userName: string | null;
  input: string;
  status: string;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  toolsUsed: string[];
  error: string | null;
  createdAt: string;
};

/** Recent assistant activity, for the observability panel in Settings. */
export async function listAgentRunsAction(limit = 25): Promise<AgentRunRow[]> {
  await requireAdmin();
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    include: { agent: { select: { name: true } }, user: { select: { name: true } } },
  });

  return runs.map((r) => {
    let toolsUsed: string[] = [];
    try {
      const parsed = r.toolsUsed ? JSON.parse(r.toolsUsed) : [];
      if (Array.isArray(parsed)) toolsUsed = parsed.map(String);
    } catch {
      toolsUsed = [];
    }
    return {
      id: r.id,
      agentName: r.agent.name,
      userName: r.user?.name ?? null,
      input: r.input,
      status: r.status,
      latencyMs: r.latencyMs,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      toolsUsed,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
