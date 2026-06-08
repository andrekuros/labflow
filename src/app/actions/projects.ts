"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { emit } from "@/lib/events";

export async function createProject(input: { key: string; name: string; description?: string; color?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const project = await prisma.project.create({
    data: {
      key: input.key.toUpperCase().slice(0, 8),
      name: input.name,
      description: input.description || null,
      color: input.color || "#6366f1",
      memberships: { create: { userId: session.id, role: "lead" } },
    },
  });

  await emit({ type: "project.created", actorId: session.id, projectId: project.id, payload: { id: project.id, name: project.name } });
  revalidatePath("/projects");
  return project;
}

export async function addMember(input: { projectId: string; userId: string; role: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");

  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId: input.userId, projectId: input.projectId } },
    update: { role: input.role },
    create: { userId: input.userId, projectId: input.projectId, role: input.role },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function createLabel(input: { projectId: string; name: string; color: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");
  const label = await prisma.label.create({ data: input });
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/board");
  return label;
}

export async function createWorkPackage(input: {
  projectId: string;
  name: string;
  code?: string;
  parentId?: string | null;
  description?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");
  const count = await prisma.workPackage.count({ where: { projectId: input.projectId, parentId: input.parentId ?? null } });
  await prisma.workPackage.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      code: input.code || null,
      parentId: input.parentId || null,
      description: input.description || null,
      order: count,
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function createSprint(input: {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");
  await prisma.sprint.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      goal: input.goal || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  revalidatePath("/sprints");
}

export async function setSprintStatus(sprintId: string, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return;
  if (!(await canWriteProject(session, sprint.projectId))) throw new Error("Sem permissao");
  await prisma.sprint.update({ where: { id: sprintId }, data: { status } });
  revalidatePath("/sprints");
}
