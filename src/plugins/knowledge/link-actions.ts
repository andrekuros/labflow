"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject } from "@/lib/rbac";
import { canViewArticle, articleVisibilityWhere } from "@/lib/knowledge-access";
import type { SessionUser } from "@/lib/auth";

export type LinkTargetType = "task" | "deliverable" | "requirement";

async function resolveTargetProjectId(targetType: LinkTargetType, targetId: string): Promise<string | null> {
  switch (targetType) {
    case "task": {
      const t = await prisma.task.findUnique({ where: { id: targetId }, select: { projectId: true } });
      return t?.projectId ?? null;
    }
    case "deliverable": {
      const d = await prisma.deliverable.findUnique({ where: { id: targetId }, select: { projectId: true } });
      return d?.projectId ?? null;
    }
    case "requirement": {
      const r = await prisma.requirement.findUnique({ where: { id: targetId }, select: { projectId: true } });
      return r?.projectId ?? null;
    }
  }
}

async function assertCanLinkTarget(session: SessionUser, targetType: LinkTargetType, targetId: string) {
  const projectId = await resolveTargetProjectId(targetType, targetId);
  if (!projectId) throw new Error("Entidade nao encontrada.");
  if (!(await canWriteProject(session, projectId))) {
    throw new Error("Sem permissao de escrita neste projeto.");
  }
  return projectId;
}

export async function getKnowledgeLinksAction(targetType: LinkTargetType, targetId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const links = await prisma.knowledgeLink.findMany({
    where: { targetType, targetId },
    include: { article: { select: { id: true, title: true, externalSource: true, projectId: true, authorId: true } } },
    orderBy: { createdAt: "desc" },
  });

  const visible = [];
  for (const l of links) {
    if (await canViewArticle(session, l.article)) {
      visible.push({
        id: l.id,
        articleId: l.article.id,
        title: l.article.title,
        externalSource: l.article.externalSource,
      });
    }
  }
  return visible;
}

export async function searchArticlesForLinkAction(projectId: string | null, query: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const q = query.trim();
  const visibility = await articleVisibilityWhere(session);
  const where: { AND: object[] } = { AND: [visibility] };

  if (projectId) {
    where.AND.push({ OR: [{ projectId }, { projectId: null }] });
  }
  if (q) {
    where.AND.push({ OR: [{ title: { contains: q } }, { tags: { contains: q } }] });
  }

  const articles = await prisma.knowledgeArticle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, externalSource: true, projectId: true, authorId: true },
  });

  const visible = [];
  for (const a of articles) {
    if (await canViewArticle(session, a)) {
      visible.push({ id: a.id, title: a.title, externalSource: a.externalSource });
    }
  }
  return visible;
}

export async function linkArticleAction(input: {
  articleId: string;
  targetType: LinkTargetType;
  targetId: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const article = await prisma.knowledgeArticle.findUnique({ where: { id: input.articleId } });
  if (!article || !(await canViewArticle(session, article))) {
    throw new Error("Artigo nao encontrado ou sem acesso.");
  }

  await assertCanLinkTarget(session, input.targetType, input.targetId);

  await prisma.knowledgeLink.upsert({
    where: {
      articleId_targetType_targetId: {
        articleId: input.articleId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
    create: {
      articleId: input.articleId,
      targetType: input.targetType,
      targetId: input.targetId,
      createdBy: session.id,
    },
    update: {},
  });

  revalidatePath("/board");
  revalidatePath("/deliverables");
  revalidatePath("/requirements");
  revalidatePath("/planning");
  revalidatePath("/projects");
  revalidatePath(`/knowledge/${input.articleId}`);
}

export async function unlinkArticleAction(linkId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const link = await prisma.knowledgeLink.findUnique({ where: { id: linkId } });
  if (!link) throw new Error("Vinculo nao encontrado.");

  await assertCanLinkTarget(session, link.targetType as LinkTargetType, link.targetId);

  await prisma.knowledgeLink.delete({ where: { id: linkId } });
  revalidatePath("/board");
  revalidatePath("/deliverables");
  revalidatePath("/requirements");
  revalidatePath("/planning");
  revalidatePath("/projects");
  revalidatePath(`/knowledge/${link.articleId}`);
}

export type ArticleBacklink = {
  id: string;
  targetType: LinkTargetType;
  targetId: string;
  title: string;
  projectKey: string;
  projectColor: string;
  href: string;
};

export async function getArticleBacklinksAction(articleId: string): Promise<ArticleBacklink[]> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
  if (!article || !(await canViewArticle(session, article))) {
    throw new Error("Artigo nao encontrado ou sem acesso.");
  }

  const links = await prisma.knowledgeLink.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
  });

  const result: ArticleBacklink[] = [];

  for (const link of links) {
    const type = link.targetType as LinkTargetType;
    if (type === "task") {
      const t = await prisma.task.findUnique({
        where: { id: link.targetId },
        include: { project: true },
      });
      if (t) {
        result.push({
          id: link.id,
          targetType: type,
          targetId: t.id,
          title: t.title,
          projectKey: t.project.key,
          projectColor: t.project.color,
          href: `/board?project=${t.projectId}`,
        });
      }
    } else if (type === "deliverable") {
      const d = await prisma.deliverable.findUnique({
        where: { id: link.targetId },
        include: { project: true },
      });
      if (d) {
        result.push({
          id: link.id,
          targetType: type,
          targetId: d.id,
          title: d.name,
          projectKey: d.project.key,
          projectColor: d.project.color,
          href: `/planning?tab=deliverables&project=${d.projectId}`,
        });
      }
    } else if (type === "requirement") {
      const r = await prisma.requirement.findUnique({
        where: { id: link.targetId },
        include: { project: true },
      });
      if (r) {
        result.push({
          id: link.id,
          targetType: type,
          targetId: r.id,
          title: r.code ? `${r.code} — ${r.title}` : r.title,
          projectKey: r.project.key,
          projectColor: r.project.color,
          href: `/planning?tab=requirements&project=${r.projectId}`,
        });
      }
    }
  }

  return result;
}
