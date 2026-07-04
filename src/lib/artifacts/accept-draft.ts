import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import type { ArtifactType } from "@/lib/artifacts/schema";
import { draftTitle } from "@/lib/artifacts/schema";

export async function acceptAiDraft(draftId: string, actorId: string) {
  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.status !== "pending") throw new Error("Rascunho invalido");

  const data = JSON.parse(draft.payload) as Record<string, unknown>;
  const projectId = draft.projectId;

  switch (draft.artifactType as ArtifactType) {
    case "requirement": {
      const r = await prisma.requirement.create({
        data: {
          projectId,
          code: (data.code as string) || null,
          title: String(data.title ?? "Requisito"),
          description: (data.description as string) || null,
          level: String(data.level ?? "system"),
          kind: String(data.kind ?? "functional"),
          priority: String(data.priority ?? "medium"),
          status: String(data.status ?? "proposed"),
          source: draft.source === "ai" ? "ia" : "import",
        },
      });
      await emit({ type: "requirement.created", actorId, projectId, targetId: r.id, payload: { id: r.id, title: r.title } });
      break;
    }
    case "task": {
      const t = await prisma.task.create({
        data: {
          projectId,
          title: String(data.title ?? "Tarefa"),
          description: (data.description as string) || null,
          status: String(data.status ?? "backlog"),
          priority: String(data.priority ?? "medium"),
          creatorId: actorId,
        },
      });
      await emit({ type: "task.created", actorId, projectId, targetId: t.id, payload: { id: t.id, title: t.title } });
      break;
    }
    case "deliverable": {
      const d = await prisma.deliverable.create({
        data: {
          projectId,
          name: String(data.name ?? data.title ?? "Entregavel"),
          description: (data.description as string) || null,
          acceptance: (data.acceptance as string) || null,
          status: String(data.status ?? "pending"),
          dueDate: data.dueDate ? new Date(String(data.dueDate)) : null,
        },
      });
      await emit({ type: "deliverable.created", actorId, projectId, targetId: d.id, payload: { id: d.id, title: d.name } });
      break;
    }
    case "work_package": {
      await prisma.workPackage.create({
        data: {
          projectId,
          code: (data.code as string) || null,
          name: String(data.name ?? "Atividade"),
          description: (data.description as string) || null,
          status: String(data.status ?? "planned"),
        },
      });
      break;
    }
    case "milestone": {
      await prisma.milestone.create({
        data: {
          projectId,
          name: String(data.name ?? "Marco"),
          description: (data.description as string) || null,
          kind: String(data.kind ?? "milestone"),
          gate: (data.gate as string) || null,
          date: data.date ? new Date(String(data.date)) : null,
          status: String(data.status ?? "upcoming"),
        },
      });
      break;
    }
    case "system_element": {
      await prisma.systemElement.create({
        data: {
          projectId,
          name: String(data.name ?? "Elemento"),
          description: (data.description as string) || null,
          kind: String(data.kind ?? "subsystem"),
        },
      });
      break;
    }
    case "verification_case": {
      const reqCode = data.requirementCode as string | undefined;
      let requirementId: string | undefined;
      if (reqCode) {
        const req = await prisma.requirement.findFirst({ where: { projectId, code: reqCode } });
        requirementId = req?.id;
      }
      if (!requirementId) {
        const first = await prisma.requirement.findFirst({ where: { projectId } });
        if (!first) throw new Error("Crie requisitos antes de casos V&V");
        requirementId = first.id;
      }
      await prisma.verificationCase.create({
        data: {
          projectId,
          requirementId,
          name: String(data.name ?? "Caso V&V"),
          method: String(data.method ?? "test"),
          status: String(data.status ?? "planned"),
        },
      });
      break;
    }
    default:
      throw new Error(`Tipo desconhecido: ${draft.artifactType}`);
  }

  await prisma.aiDraft.update({ where: { id: draftId }, data: { status: "accepted" } });
}

export async function createDraftsFromBundle(
  projectId: string,
  bundle: {
    requirements?: Record<string, unknown>[];
    tasks?: Record<string, unknown>[];
    deliverables?: Record<string, unknown>[];
    workPackages?: Record<string, unknown>[];
    milestones?: Record<string, unknown>[];
    systemElements?: Record<string, unknown>[];
    verificationCases?: Record<string, unknown>[];
  },
  source: "ai" | "import",
  createdBy?: string,
) {
  const rows: { artifactType: ArtifactType; title: string; payload: string }[] = [];

  const push = (type: ArtifactType, items?: Record<string, unknown>[]) => {
    for (const item of items ?? []) {
      rows.push({
        artifactType: type,
        title: draftTitle(type, item),
        payload: JSON.stringify(item),
      });
    }
  };

  push("requirement", bundle.requirements);
  push("task", bundle.tasks);
  push("deliverable", bundle.deliverables);
  push("work_package", bundle.workPackages);
  push("milestone", bundle.milestones);
  push("system_element", bundle.systemElements);
  push("verification_case", bundle.verificationCases);

  if (rows.length === 0) return 0;

  await prisma.aiDraft.createMany({
    data: rows.map((r) => ({
      projectId,
      artifactType: r.artifactType,
      title: r.title,
      payload: r.payload,
      source,
      createdBy: createdBy ?? null,
    })),
  });

  return rows.length;
}
