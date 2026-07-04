import "server-only";
import { prisma } from "@/lib/db";
import { chat, aiEnabled, type ChatMessage } from "@/lib/ai/provider";
import { search } from "@/lib/ai/rag";
import { ingest } from "@/lib/ai/rag";
import { getPluginSettings } from "@/plugins/registry";

type FeedbackPayload = {
  id: string;
  title: string;
  description: string;
  category: string;
  platformUrl?: string | null;
};

/**
 * Processes a feedback submission: searches RAG for context, asks the LLM to
 * suggest tasks/requirements, and creates AiDraft records in the configured
 * internal project.
 */
export async function processFeedback(payload: FeedbackPayload) {
  if (!(await aiEnabled())) return;

  const settings = await getPluginSettings("feedback");
  const projectRef = settings?.feedbackProjectId as string | undefined;
  if (!projectRef) return;

  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectRef }, { key: projectRef }] },
  });
  if (!project) return;

  const ragHits = await search(`${payload.title} ${payload.description}`, { limit: 5 });
  const context = ragHits.map((h) => `- [${h.sourceType}] ${h.chunk}`).join("\n");

  const prompt = `Voce e um analista de software. Um usuario reportou o seguinte feedback na plataforma LabFlow:

TITULO: ${payload.title}
DESCRICAO: ${payload.description}
CATEGORIA: ${payload.category}
URL: ${payload.platformUrl || "N/A"}

CONTEXTO RELEVANTE DA BASE DE CONHECIMENTO:
${context || "(nenhum contexto encontrado)"}

Com base nesse feedback, sugira tarefas e/ou requisitos para o projeto de desenvolvimento da plataforma.
Responda SOMENTE com JSON valido (sem markdown) no formato:
{
  "tasks": [{ "title": "...", "description": "...", "status": "backlog", "priority": "medium" }],
  "requirements": [{ "code": "FB-001", "title": "...", "description": "...", "level": "system", "kind": "functional", "priority": "medium" }]
}

Gere entre 1 e 4 itens no total. Texto em portugues.`;

  const messages: ChatMessage[] = [
    { role: "system", content: "Responda somente com JSON. Sem explicacoes." },
    { role: "user", content: prompt },
  ];

  try {
    const raw = await chat(messages);
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) return;

    const result = JSON.parse(trimmed.slice(start, end + 1)) as {
      tasks?: Array<Record<string, unknown>>;
      requirements?: Array<Record<string, unknown>>;
    };

    const draftIds: string[] = [];

    for (const task of result.tasks ?? []) {
      const draft = await prisma.aiDraft.create({
        data: {
          projectId: project.id,
          artifactType: "task",
          title: String(task.title || "Tarefa do feedback"),
          payload: JSON.stringify(task),
          source: "ai",
          createdBy: "feedback-agent",
        },
      });
      draftIds.push(draft.id);
    }

    for (const req of result.requirements ?? []) {
      const draft = await prisma.aiDraft.create({
        data: {
          projectId: project.id,
          artifactType: "requirement",
          title: String(req.title || "Requisito do feedback"),
          payload: JSON.stringify(req),
          source: "ai",
          createdBy: "feedback-agent",
        },
      });
      draftIds.push(draft.id);
    }

    if (draftIds.length > 0) {
      await prisma.feedback.update({
        where: { id: payload.id },
        data: { linkedDrafts: JSON.stringify(draftIds) },
      });
    }
  } catch (err) {
    console.error("[feedback-agent] failed to process feedback", err);
  }

  await ingest({
    sourceType: "article",
    sourceId: `feedback-${payload.id}`,
    text: `Feedback: ${payload.title}\n${payload.description}\nCategoria: ${payload.category}`,
  });
}
