"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { emit } from "@/lib/events";

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
      sprintId: input.sprintId || null,
      creatorId: session.id,
      order: count,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignees: input.assigneeIds?.length ? { connect: input.assigneeIds.map((id) => ({ id })) } : undefined,
      labels: input.labelIds?.length ? { connect: input.labelIds.map((id) => ({ id })) } : undefined,
    },
  });

  await emit({
    type: "task.created",
    actorId: session.id,
    projectId: input.projectId,
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

  await prisma.task.update({
    where: { id: input.taskId },
    data: { status: input.status, order: input.order },
  });

  await emit({
    type: "task.moved",
    actorId: session.id,
    projectId: task.projectId,
    payload: { id: task.id, from: task.status, to: input.status },
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

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      workPackageId: input.workPackageId,
      sprintId: input.sprintId,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      assignees: input.assigneeIds ? { set: input.assigneeIds.map((id) => ({ id })) } : undefined,
      labels: input.labelIds ? { set: input.labelIds.map((id) => ({ id })) } : undefined,
    },
  });

  await emit({ type: "task.updated", actorId: session.id, projectId: task.projectId, payload: { id: task.id } });
  revalidatePath("/board");
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
