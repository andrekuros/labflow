import "server-only";
import { prisma } from "@/lib/db";
import { ARTIFACTS_FORMAT_VERSION, parseConops, type ArtifactsBundle } from "@/lib/artifacts/schema";

export async function exportProjectArtifacts(projectId: string): Promise<ArtifactsBundle> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const [requirements, tasks, deliverables, workPackages, milestones, systemElements, verificationCases] =
    await Promise.all([
      prisma.requirement.findMany({ where: { projectId } }),
      prisma.task.findMany({ where: { projectId }, include: { assignees: { select: { email: true } } } }),
      prisma.deliverable.findMany({ where: { projectId } }),
      prisma.workPackage.findMany({ where: { projectId } }),
      prisma.milestone.findMany({ where: { projectId } }),
      prisma.systemElement.findMany({ where: { projectId } }),
      prisma.verificationCase.findMany({ where: { projectId } }),
    ]);

  return {
    version: ARTIFACTS_FORMAT_VERSION,
    projectKey: project.key,
    projectName: project.name,
    exportedAt: new Date().toISOString(),
    conops: parseConops(project.conops),
    requirements: requirements.map((r) => ({
      _ref: r.code ?? r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      level: r.level,
      kind: r.kind,
      priority: r.priority,
      status: r.status,
      source: r.source,
      parentRef: null,
    })),
    tasks: tasks.map((t) => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      workPackageCode: null,
    })),
    deliverables: deliverables.map((d) => ({
      name: d.name,
      description: d.description,
      acceptance: d.acceptance,
      status: d.status,
      dueDate: d.dueDate?.toISOString().slice(0, 10) ?? null,
    })),
    workPackages: workPackages.map((w) => ({
      _ref: w.code ?? w.id,
      code: w.code,
      name: w.name,
      description: w.description,
      status: w.status,
      parentRef: null,
    })),
    milestones: milestones.map((m) => ({
      name: m.name,
      description: m.description,
      kind: m.kind,
      gate: m.gate,
      date: m.date?.toISOString().slice(0, 10) ?? null,
      status: m.status,
    })),
    systemElements: systemElements.map((e) => ({
      _ref: e.id,
      name: e.name,
      description: e.description,
      kind: e.kind,
      parentRef: null,
    })),
    verificationCases: verificationCases.map((v) => ({
      name: v.name,
      method: v.method,
      status: v.status,
      requirementCode: null,
    })),
  };
}
