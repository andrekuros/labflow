"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { emit } from "@/lib/events";

export async function createDeliverable(input: {
  projectId: string;
  name: string;
  description?: string;
  acceptance?: string;
  dueDate?: string | null;
  workPackageId?: string | null;
  requirementIds?: string[];
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");

  const d = await prisma.deliverable.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      description: input.description || null,
      acceptance: input.acceptance || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      workPackageId: input.workPackageId || null,
      requirements: input.requirementIds?.length ? { connect: input.requirementIds.map((id) => ({ id })) } : undefined,
    },
  });

  await emit({ type: "deliverable.created", actorId: session.id, projectId: input.projectId, payload: { id: d.id, title: d.name, description: d.description } });
  revalidatePath("/deliverables");
  return d;
}

export async function setDeliverableStatus(id: string, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const d = await prisma.deliverable.findUnique({ where: { id } });
  if (!d) return;
  if (!(await canWriteProject(session, d.projectId))) throw new Error("Sem permissao");
  await prisma.deliverable.update({ where: { id }, data: { status } });
  await emit({ type: "deliverable.updated", actorId: session.id, projectId: d.projectId, payload: { id } });
  revalidatePath("/deliverables");
}
