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

export async function createSystemElement(input: {
  projectId: string;
  name: string;
  description?: string;
  kind?: string;
  parentId?: string | null;
}) {
  await authorize(input.projectId);
  const count = await prisma.systemElement.count({ where: { projectId: input.projectId, parentId: input.parentId ?? null } });
  const el = await prisma.systemElement.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      description: input.description || null,
      kind: input.kind ?? "subsystem",
      parentId: input.parentId || null,
      order: count,
    },
  });
  revalidatePath("/system-model");
  revalidatePath(`/projects/${input.projectId}`);
  return el;
}

export async function createInterface(input: {
  projectId: string;
  fromId: string;
  toId: string;
  name: string;
  description?: string;
  kind?: string;
  protocol?: string;
}) {
  await authorize(input.projectId);
  const iface = await prisma.interface.create({
    data: {
      projectId: input.projectId,
      fromId: input.fromId,
      toId: input.toId,
      name: input.name,
      description: input.description || null,
      kind: input.kind ?? "data",
      protocol: input.protocol || null,
    },
  });
  revalidatePath("/system-model");
  return iface;
}

export async function updateSystemDiagram(id: string, diagram: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const el = await prisma.systemElement.findUnique({ where: { id } });
  if (!el) return;
  if (!(await canWriteProject(session, el.projectId))) throw new Error("Sem permissao");
  await prisma.systemElement.update({ where: { id }, data: { diagram } });
  revalidatePath("/system-model");
}
