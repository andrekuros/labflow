"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { emit } from "@/lib/events";
import {
  type TaskChecklistItem,
  parseChecklist,
  serializeChecklist,
  newChecklistItem,
} from "@/lib/task-checklist";

async function authorize(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const ok = await canWriteProject(session, projectId);
  if (!ok) throw new Error("Sem permissao de escrita neste projeto");
  return session;
}

export async function createTask(input: {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  workPackageId?: string | null;
  estimate?: number | null;
  sprintId?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  dueDate?: string | null;
}) {
  const session = await authorize(input.projectId);
  const count = await prisma.task.count({ where: { projectId: input.projectId, status: input.status ?? "backlog" } });

  const task = await prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description || null,
      status: input.status ?? "backlog",
      priority: input.priority ?? "medium",
      workPackageId: input.workPackageId || null,
      estimate: input.estimate ?? null,
      sprintId: input.sprintId || null,
      creatorId: session.id,
      order: count,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignees: input.assigneeIds?.length ? { connect: input.assigneeIds.map((id) => ({ id })) } : undefined,
      labels: input.labelIds?.length ? { connect: input.labelIds.map((id) => ({ id })) } : undefined,
    },
    include: { assignees: true, labels: true, project: true },
  });

  await emit({
    type: "task.created",
    actorId: session.id,
    projectId: input.projectId,
    targetId: task.id,
    payload: { id: task.id, title: task.title, description: task.description },
  });

  revalidatePath("/board");
  return task;
}

export async function moveTask(input: { taskId: string; status: string; order: number }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw new Error("Tarefa nao encontrada");
  await authorize(task.projectId);

  const targetOrder = Math.max(0, input.order);
  const oldStatus = task.status;
  const newStatus = input.status;

  await prisma.$transaction(async (tx) => {
    if (oldStatus !== newStatus) {
      const oldSiblings = await tx.task.findMany({
        where: { projectId: task.projectId, status: oldStatus },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
      const oldWithout = oldSiblings.filter((t) => t.id !== task.id);
      for (let i = 0; i < oldWithout.length; i++) {
        await tx.task.update({ where: { id: oldWithout[i].id }, data: { order: i } });
      }

      const newSiblings = await tx.task.findMany({
        where: { projectId: task.projectId, status: newStatus, id: { not: task.id } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
      const insertAt = Math.min(targetOrder, newSiblings.length);
      newSiblings.splice(insertAt, 0, task);
      for (let i = 0; i < newSiblings.length; i++) {
        await tx.task.update({
          where: { id: newSiblings[i].id },
          data: { status: newStatus, order: i },
        });
      }
      return;
    }

    const siblings = await tx.task.findMany({
      where: { projectId: task.projectId, status: oldStatus },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    const oldIndex = siblings.findIndex((t) => t.id === task.id);
    if (oldIndex === -1) return;

    const reordered = [...siblings];
    reordered.splice(oldIndex, 1);
    const insertAt = Math.min(targetOrder, reordered.length);
    reordered.splice(insertAt, 0, task);
    for (let i = 0; i < reordered.length; i++) {
      await tx.task.update({ where: { id: reordered[i].id }, data: { order: i } });
    }
  });

  await emit({
    type: "task.moved",
    actorId: session.id,
    projectId: task.projectId,
    targetId: task.id,
    payload: { id: task.id, from: oldStatus, to: newStatus },
  });

  revalidatePath("/board");
}

export async function updateTask(input: {
  taskId: string;
  title?: string;
  description?: string | null;
  priority?: string;
  status?: string;
  workPackageId?: string | null;
  estimate?: number | null;
  sprintId?: string | null;
  dueDate?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw new Error("Tarefa nao encontrada");
  await authorize(task.projectId);

  const updated = await prisma.task.update({
    where: { id: input.taskId },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      workPackageId: input.workPackageId,
      estimate: input.estimate,
      sprintId: input.sprintId,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      assignees: input.assigneeIds ? { set: input.assigneeIds.map((id) => ({ id })) } : undefined,
      labels: input.labelIds ? { set: input.labelIds.map((id) => ({ id })) } : undefined,
    },
    include: { assignees: true, labels: true, project: true },
  });

  await emit({ type: "task.updated", actorId: session.id, projectId: task.projectId, targetId: task.id, payload: { id: task.id, title: input.title ?? task.title, description: input.description ?? task.description } });
  revalidatePath("/board");
  revalidatePath(`/projects/${task.projectId}`);
  return updated;
}

export async function deleteTask(taskId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  await authorize(task.projectId);
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/board");
}

export async function addComment(taskId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Tarefa nao encontrada");
  const c = await prisma.comment.create({ data: { taskId, authorId: session.id, content } });
  revalidatePath("/board");
  return c;
}

export async function updateTaskChecklist(
  taskId: string,
  items: TaskChecklistItem[],
): Promise<{ error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: "Nao autenticado" };

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tarefa nao encontrada" };
    if (!(await canWriteProject(session, task.projectId))) return { error: "Sem permissao" };

    const normalized = items
      .map((item, index) => ({
        id: item.id || `step-${index}`,
        title: item.title.trim(),
        done: Boolean(item.done),
        order: index,
      }))
      .filter((item) => item.title.length > 0);

    await prisma.task.update({
      where: { id: taskId },
      data: { checklistJson: serializeChecklist(normalized) },
    });

    await emit({
      type: "task.updated",
      actorId: session.id,
      projectId: task.projectId,
      targetId: taskId,
      payload: { id: taskId, title: task.title },
    });

    revalidatePath("/board");
    revalidatePath(`/projects/${task.projectId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar checklist" };
  }
}

export async function generateTaskStepsWithAiAction(
  taskId: string,
): Promise<{ error?: string; items?: TaskChecklistItem[] }> {
  try {
    const session = await getSession();
    if (!session) return { error: "Nao autenticado" };

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { workPackage: { select: { code: true, name: true } } },
    });
    if (!task) return { error: "Tarefa nao encontrada" };
    if (!(await canWriteProject(session, task.projectId))) return { error: "Sem permissao" };

    const { aiEnabled } = await import("@/lib/ai/provider");
    if (!(await aiEnabled())) return { error: "IA nao configurada. Ajuste em Configuracoes." };

    const existingSteps = parseChecklist(task.checklistJson);
    const { generateTaskStepsWithAi } = await import("@/lib/ai/task-steps-generator");
    const result = await generateTaskStepsWithAi({
      projectId: task.projectId,
      taskTitle: task.title,
      taskDescription: task.description,
      taskStatus: task.status,
      taskPriority: task.priority,
      workPackageLabel: task.workPackage
        ? `${task.workPackage.code ?? ""} ${task.workPackage.name}`.trim()
        : null,
      existingSteps,
    });

    const items = result.steps.map((s, index) => newChecklistItem(s.title, index));
    await prisma.task.update({
      where: { id: taskId },
      data: { checklistJson: serializeChecklist(items) },
    });

    await emit({
      type: "task.updated",
      actorId: session.id,
      projectId: task.projectId,
      targetId: taskId,
      payload: { id: taskId, title: task.title },
    });

    revalidatePath("/board");
    revalidatePath(`/projects/${task.projectId}`);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao gerar steps com IA" };
  }
}
