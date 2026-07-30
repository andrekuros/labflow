"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canViewProject, canWriteProject } from "@/lib/rbac";
import { aiEnabled } from "@/lib/ai/provider";
import {
  loadSprintPlannerContext,
  suggestSprintPlanWithAi,
  type SprintPlannerInput,
} from "@/lib/ai/sprint-planner";
import { draftTitle } from "@/lib/artifacts/schema";

export async function loadSprintPlannerContextAction(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canViewProject(session, projectId))) throw new Error("Sem permissao");
  return loadSprintPlannerContext(projectId);
}

export async function suggestSprintPlanWithAiAction(
  input: SprintPlannerInput,
): Promise<{ draftId: string; title: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!(await canWriteProject(session, input.projectId))) return { error: "Sem permissao" };
  if (!(await aiEnabled())) return { error: "IA nao configurada. Verifique as configuracoes do assistente." };

  try {
    const plan = await suggestSprintPlanWithAi(input);
    const payload = JSON.stringify(plan);
    const title = draftTitle("sprint_plan", plan as unknown as Record<string, unknown>);

    const draft = await prisma.aiDraft.create({
      data: {
        projectId: input.projectId,
        artifactType: "sprint_plan",
        title,
        payload,
        source: "ai",
        status: "pending",
      },
    });

    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/planning");
    return { draftId: draft.id, title };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao gerar plano de sprint" };
  }
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
  const sprint = await prisma.sprint.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      goal: input.goal || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  const { emit } = await import("@/lib/events");
  await emit({
    type: "sprint.created",
    actorId: session.id,
    projectId: input.projectId,
    targetId: sprint.id,
    payload: { id: sprint.id, name: sprint.name, taskCount: 0 },
  });
  revalidatePath("/sprints");
  revalidatePath("/planning");
}

export async function setSprintStatus(sprintId: string, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return;
  if (!(await canWriteProject(session, sprint.projectId))) throw new Error("Sem permissao");
  await prisma.sprint.update({ where: { id: sprintId }, data: { status } });
  revalidatePath("/sprints");
  revalidatePath("/planning");
}
