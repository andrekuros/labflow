"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { emit } from "@/lib/events";
import { getPluginSettings } from "@/plugins/registry";

export async function createProject(input: { key: string; name: string; description?: string; color?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const settings = getPluginSettings("projects");
  const maxKeyLength = Number(settings.maxKeyLength ?? 8);

  const project = await prisma.project.create({
    data: {
      key: input.key.toUpperCase().slice(0, maxKeyLength),
      name: input.name,
      description: input.description || null,
      color: input.color || String(settings.defaultColor ?? "#6366f1"),
      memberships: { create: { userId: session.id, role: "lead" } },
    },
  });

  await emit({ type: "project.created", actorId: session.id, projectId: project.id, payload: { id: project.id, name: project.name } });
  revalidatePath("/projects");
  return project;
}

export async function createProjectFromTemplate(
  template: "se" | "blank",
  input: { key: string; name: string; description?: string; color?: string },
) {
  if (template === "blank") return createProject(input);

  const project = await createProject(input);

  const wbs = [
    { code: "1", name: "Concepcao" },
    { code: "2", name: "Requisitos" },
    { code: "3", name: "Design" },
    { code: "4", name: "Implementacao" },
    { code: "5", name: "Integracao" },
    { code: "6", name: "Verificacao e validacao" },
  ];

  for (const [i, w] of wbs.entries()) {
    await prisma.workPackage.create({
      data: { projectId: project.id, code: w.code, name: w.name, order: i },
    });
  }

  const gates = [
    { gate: "SRR", name: "System Requirements Review", kind: "verification" },
    { gate: "PDR", name: "Preliminary Design Review", kind: "verification" },
    { gate: "CDR", name: "Critical Design Review", kind: "verification" },
    { gate: "TRR", name: "Test Readiness Review", kind: "verification" },
    { gate: "FRR", name: "Flight/Field Readiness Review", kind: "release" },
  ];

  for (const g of gates) {
    await prisma.milestone.create({
      data: { projectId: project.id, name: g.name, gate: g.gate, kind: g.kind, status: "upcoming" },
    });
  }

  await prisma.systemElement.create({
    data: { projectId: project.id, name: input.name, kind: "system", description: "System of Interest" },
  });

  await prisma.requirement.createMany({
    data: [
      {
        projectId: project.id,
        code: "SN-001",
        title: "Necessidade do stakeholder (exemplo)",
        level: "stakeholder",
        kind: "goal",
        status: "proposed",
      },
      {
        projectId: project.id,
        code: "SYS-001",
        title: "Requisito de sistema (exemplo)",
        level: "system",
        kind: "functional",
        status: "proposed",
      },
    ],
  });

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
