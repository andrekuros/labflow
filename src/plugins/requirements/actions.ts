"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { emit } from "@/lib/events";

async function authorize(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, projectId))) throw new Error("Sem permissao");
  return session;
}

export async function createRequirement(input: {
  projectId: string;
  title: string;
  code?: string;
  description?: string;
  kind?: string;
  priority?: string;
  level?: string;
  parentId?: string | null;
  allocatedToId?: string | null;
  source?: string;
  activityIds?: string[];
}) {
  const session = await authorize(input.projectId);
  const r = await prisma.requirement.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      code: input.code || null,
      description: input.description || null,
      kind: input.kind ?? "goal",
      priority: input.priority ?? "medium",
      level: input.level ?? "system",
      parentId: input.parentId || null,
      allocatedToId: input.allocatedToId || null,
      source: input.source || null,
      activities: input.activityIds?.length ? { connect: input.activityIds.map((id) => ({ id })) } : undefined,
    },
  });
  await emit({ type: "requirement.created", actorId: session.id, projectId: input.projectId, targetId: r.id, payload: { id: r.id, title: r.title } });
  revalidatePath("/requirements");
  return r;
}

export async function setRequirementStatus(id: string, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const r = await prisma.requirement.findUnique({ where: { id } });
  if (!r) return;
  if (!(await canWriteProject(session, r.projectId))) throw new Error("Sem permissao");
  await prisma.requirement.update({ where: { id }, data: { status } });
  revalidatePath("/requirements");
}

export async function getRequirementTree(projectId: string) {
  const rows = await prisma.requirement.findMany({
    where: { projectId },
    include: { children: true, allocatedTo: true },
    orderBy: { code: "asc" },
  });
  return rows.filter((r) => !r.parentId);
}
