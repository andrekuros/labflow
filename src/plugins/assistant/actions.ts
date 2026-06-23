"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { askKnowledge, type AgentAnswer } from "@/lib/ai/agent";
import { listAiTools } from "@/plugins/registry";

export async function askAssistant(input: { question: string; agentKey?: string }): Promise<AgentAnswer> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const agent = input.agentKey
    ? await prisma.agentConfig.findUnique({ where: { key: input.agentKey } })
    : null;

  const result = await askKnowledge(input.question, { instructions: agent?.instructions });

  if (agent) {
    await prisma.agentRun.create({
      data: { agentId: agent.id, userId: session.id, input: input.question, output: result.answer, status: "done" },
    });
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
