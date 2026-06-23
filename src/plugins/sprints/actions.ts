"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";

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
