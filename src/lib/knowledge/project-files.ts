import "server-only";
import { prisma } from "@/lib/db";
import type { ProjectFileRow } from "@/lib/knowledge/project-file-types";

export type { ProjectFileLink, ProjectFileRow } from "@/lib/knowledge/project-file-types";

type ArticlePick = {
  id: string;
  title: string;
  kind: string;
  fileName: string | null;
  externalFolder: string | null;
  externalSource: string | null;
  updatedAt: Date;
};

function toRow(a: ArticlePick): ProjectFileRow {
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    fileName: a.fileName,
    externalFolder: a.externalFolder,
    externalSource: a.externalSource,
    updatedAt: a.updatedAt.toISOString(),
    links: [],
  };
}

function entityLabel(type: string, id: string, maps: Record<string, Map<string, string>>): string {
  return maps[type]?.get(id) ?? type;
}

/** Union of articles owned by the project or linked to its work items. */
export async function listProjectLibraryArticles(projectId: string): Promise<ProjectFileRow[]> {
  const [tasks, deliverables, requirements, verifications, owned] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, select: { id: true, title: true } }),
    prisma.deliverable.findMany({ where: { projectId }, select: { id: true, name: true } }),
    prisma.requirement.findMany({ where: { projectId }, select: { id: true, code: true, title: true } }),
    prisma.verificationCase.findMany({ where: { projectId }, select: { id: true, name: true } }),
    prisma.knowledgeArticle.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        kind: true,
        fileName: true,
        externalFolder: true,
        externalSource: true,
        updatedAt: true,
      },
    }),
  ]);

  const maps: Record<string, Map<string, string>> = {
    task: new Map(tasks.map((t) => [t.id, t.title])),
    deliverable: new Map(deliverables.map((d) => [d.id, d.name])),
    requirement: new Map(requirements.map((r) => [r.id, r.code ? `${r.code} — ${r.title}` : r.title])),
    verification: new Map(verifications.map((v) => [v.id, v.name])),
  };

  const or: { targetType: string; targetId: string | { in: string[] } }[] = [
    { targetType: "project", targetId: projectId },
  ];
  if (tasks.length) or.push({ targetType: "task", targetId: { in: tasks.map((t) => t.id) } });
  if (deliverables.length) or.push({ targetType: "deliverable", targetId: { in: deliverables.map((d) => d.id) } });
  if (requirements.length) or.push({ targetType: "requirement", targetId: { in: requirements.map((r) => r.id) } });
  if (verifications.length) or.push({ targetType: "verification", targetId: { in: verifications.map((v) => v.id) } });

  const links = await prisma.knowledgeLink.findMany({
    where: { OR: or },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          kind: true,
          fileName: true,
          externalFolder: true,
          externalSource: true,
          updatedAt: true,
        },
      },
    },
  });

  const byId = new Map<string, ProjectFileRow>();
  for (const a of owned) byId.set(a.id, toRow(a));

  for (const link of links) {
    const row = byId.get(link.article.id) ?? toRow(link.article);
    if (link.targetType !== "project") {
      row.links.push({
        targetType: link.targetType,
        targetId: link.targetId,
        label: entityLabel(link.targetType, link.targetId, maps),
      });
    } else if (!row.links.some((l) => l.targetType === "project")) {
      row.links.push({ targetType: "project", targetId: projectId, label: "Projeto" });
    }
    byId.set(link.article.id, row);
  }

  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
