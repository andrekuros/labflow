"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";

async function authorize(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, projectId))) throw new Error("Sem permissao");
  return session;
}

export async function createMilestone(input: {
  projectId: string;
  name: string;
  description?: string;
  kind?: string;
  gate?: string | null;
  date?: string | null;
}) {
  await authorize(input.projectId);
  await prisma.milestone.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      description: input.description || null,
      kind: input.kind ?? "milestone",
      gate: input.gate || null,
      date: input.date ? new Date(input.date) : null,
    },
  });
  revalidatePath("/roadmap");
}

export async function setMilestoneStatus(id: string, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const m = await prisma.milestone.findUnique({ where: { id } });
  if (!m) return;
  if (!(await canWriteProject(session, m.projectId))) throw new Error("Sem permissao");
  await prisma.milestone.update({ where: { id }, data: { status } });
  revalidatePath("/roadmap");
}
