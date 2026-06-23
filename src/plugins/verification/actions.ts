"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";

export async function createVerificationCase(input: {
  projectId: string;
  requirementId: string;
  name: string;
  method?: string;
  milestoneId?: string | null;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");

  const vc = await prisma.verificationCase.create({
    data: {
      projectId: input.projectId,
      requirementId: input.requirementId,
      name: input.name,
      method: input.method ?? "test",
      milestoneId: input.milestoneId || null,
    },
  });
  revalidatePath("/verification");
  revalidatePath("/requirements");
  return vc;
}

export async function setVerificationStatus(id: string, status: string, result?: string, evidence?: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const vc = await prisma.verificationCase.findUnique({ where: { id }, include: { requirement: true } });
  if (!vc) return;
  if (!(await canWriteProject(session, vc.projectId))) throw new Error("Sem permissao");

  await prisma.verificationCase.update({
    where: { id },
    data: { status, result: result ?? vc.result, evidence: evidence ?? vc.evidence },
  });

  if (status === "passed") {
    await prisma.requirement.update({ where: { id: vc.requirementId }, data: { status: "verified" } });
  }

  revalidatePath("/verification");
  revalidatePath("/requirements");
}
