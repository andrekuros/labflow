"use server";

import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/rbac";
import { emit } from "@/lib/events";
import { redirect } from "next/navigation";
import { chat, aiEnabled, type ChatMessage } from "@/lib/ai/provider";
import { search } from "@/lib/ai/rag";

export type FeedbackCategory = "bug" | "suggestion" | "question" | "equipment";

export type FeedbackInput = {
  title: string;
  description: string;
  category: FeedbackCategory;
  platformUrl?: string;
  projectId?: string;
};

const FEEDBACK_INCLUDE = {
  submittedBy: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, key: true, name: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
} as const;

export async function submitFeedback(data: FeedbackInput) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:create");
  if (!ok) return { error: "Sem permissao" };

  const fb = await prisma.feedback.create({
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category,
      platformUrl: data.platformUrl || null,
      projectId: data.projectId || null,
      submittedById: user.id,
    },
  });

  await emit({
    type: "feedback.submitted",
    actorId: user.id,
    projectId: data.projectId || null,
    payload: { id: fb.id, title: fb.title, description: fb.description, category: fb.category, platformUrl: fb.platformUrl },
  });

  return { id: fb.id };
}

export async function listFeedbacks() {
  const user = await requireUser();
  const canManage = await hasPermission(user, "feedback:manage");

  const where = canManage ? {} : { submittedById: user.id };
  return prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: FEEDBACK_INCLUDE,
  });
}

export async function updateFeedbackStatus(id: string, status: string) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) return { error: "Sem permissao" };

  await prisma.feedback.update({ where: { id }, data: { status } });
  return { ok: true };
}

export async function assignFeedback(id: string, assigneeId: string | null) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) return { error: "Sem permissao" };

  await prisma.feedback.update({
    where: { id },
    data: { assigneeId, status: assigneeId ? "in_progress" : undefined },
  });
  return { ok: true };
}

export async function linkFeedbackProject(id: string, projectId: string | null) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) return { error: "Sem permissao" };

  await prisma.feedback.update({ where: { id }, data: { projectId } });
  return { ok: true };
}

export async function addFeedbackComment(feedbackId: string, content: string) {
  const user = await requireUser();
  if (!content.trim()) return { error: "Comentario vazio" };

  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb) return { error: "Feedback nao encontrado" };

  const canManage = await hasPermission(user, "feedback:manage");
  if (!canManage && fb.submittedById !== user.id) return { error: "Sem permissao" };

  const comment = await prisma.feedbackComment.create({
    data: { feedbackId, authorId: user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true } } },
  });

  return comment;
}

export async function generateDraftsFromFeedback(feedbackId: string, targetProjectId: string) {
  const user = await requireUser();
  if (!(await aiEnabled())) return { error: "IA nao configurada" };

  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb) return { error: "Feedback nao encontrado" };

  const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
  if (!project) return { error: "Projeto nao encontrado" };

  const ragHits = await search(`${fb.title} ${fb.description}`, { limit: 5 });
  const context = ragHits.map((h) => `- [${h.sourceType}] ${h.chunk}`).join("\n");

  const prompt = `Voce e um analista de software. Um usuario reportou o seguinte feedback na plataforma LabFlow:

TITULO: ${fb.title}
DESCRICAO: ${fb.description}
CATEGORIA: ${fb.category}
URL: ${fb.platformUrl || "N/A"}
PROJETO: ${project.name} (${project.key})

CONTEXTO RELEVANTE:
${context || "(nenhum)"}

Sugira tarefas e/ou requisitos para resolver esse feedback.
Responda SOMENTE com JSON valido (sem markdown):
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
    if (start === -1 || end === -1) return { error: "IA nao retornou JSON valido" };

    const result = JSON.parse(trimmed.slice(start, end + 1)) as {
      tasks?: Array<Record<string, unknown>>;
      requirements?: Array<Record<string, unknown>>;
    };

    const draftIds: string[] = [];

    for (const task of result.tasks ?? []) {
      const draft = await prisma.aiDraft.create({
        data: {
          projectId: targetProjectId,
          artifactType: "task",
          title: String(task.title || "Tarefa do feedback"),
          payload: JSON.stringify(task),
          source: "ai",
          createdBy: user.id,
        },
      });
      draftIds.push(draft.id);
    }

    for (const req of result.requirements ?? []) {
      const draft = await prisma.aiDraft.create({
        data: {
          projectId: targetProjectId,
          artifactType: "requirement",
          title: String(req.title || "Requisito do feedback"),
          payload: JSON.stringify(req),
          source: "ai",
          createdBy: user.id,
        },
      });
      draftIds.push(draft.id);
    }

    if (draftIds.length > 0) {
      const existing = JSON.parse(fb.linkedDrafts || "[]") as string[];
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { linkedDrafts: JSON.stringify([...existing, ...draftIds]) },
      });
    }

    const drafts = await prisma.aiDraft.findMany({
      where: { id: { in: draftIds } },
      select: { id: true, artifactType: true, title: true, payload: true, status: true },
    });

    return { drafts };
  } catch (err) {
    console.error("[feedback] AI generation failed", err);
    return { error: "Falha ao gerar sugestoes" };
  }
}

export async function acceptFeedbackDraft(draftId: string) {
  const user = await requireUser();

  const { acceptAiDraft } = await import("@/lib/artifacts/accept-draft");
  await acceptAiDraft(draftId, user.id);

  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (!draft) return { ok: true };

  if (draft.artifactType === "task") {
    const data = JSON.parse(draft.payload) as Record<string, unknown>;
    const task = await prisma.task.findFirst({
      where: { projectId: draft.projectId, title: String(data.title ?? "") },
      orderBy: { createdAt: "desc" },
    });

    if (task) {
      const feedbacks = await prisma.feedback.findMany({
        where: { linkedDrafts: { contains: draftId } },
        select: { assigneeId: true },
      });
      const assigneeId = feedbacks[0]?.assigneeId;
      if (assigneeId) {
        await prisma.task.update({
          where: { id: task.id },
          data: { assignees: { connect: { id: assigneeId } } },
        });
      }
    }
  }

  return { ok: true };
}

export async function rejectFeedbackDraft(draftId: string) {
  const user = await requireUser();
  await prisma.aiDraft.update({ where: { id: draftId }, data: { status: "rejected" } });
  return { ok: true };
}

export async function listActiveProjects() {
  await requireUser();
  return prisma.project.findMany({
    where: { status: "active" },
    select: { id: true, key: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listUsers() {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) return [];

  return prisma.user.findMany({
    where: { accountStatus: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
