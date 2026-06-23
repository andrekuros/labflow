"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type LinkTargetType = "task" | "deliverable" | "requirement";

export async function getKnowledgeLinksAction(targetType: LinkTargetType, targetId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const links = await prisma.knowledgeLink.findMany({
    where: { targetType, targetId },
    include: { article: { select: { id: true, title: true, externalSource: true } } },
    orderBy: { createdAt: "desc" },
  });

  return links.map((l) => ({
    id: l.id,
    articleId: l.article.id,
    title: l.article.title,
    externalSource: l.article.externalSource,
  }));
}

export async function searchArticlesForLinkAction(projectId: string | null, query: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const q = query.trim();
  const where: { projectId?: string | null; OR?: object[]; AND?: object[] } = {};
  if (projectId) {
    where.OR = [{ projectId }, { projectId: null }];
  }
  if (q) {
    where.AND = [{ OR: [{ title: { contains: q } }, { tags: { contains: q } }] }];
  }

  const articles = await prisma.knowledgeArticle.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, externalSource: true },
  });

  return articles;
}

export async function linkArticleAction(input: {
  articleId: string;
  targetType: LinkTargetType;
  targetId: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

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
  revalidatePath("/projects");
}

export async function unlinkArticleAction(linkId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  await prisma.knowledgeLink.delete({ where: { id: linkId } });
  revalidatePath("/board");
  revalidatePath("/deliverables");
  revalidatePath("/requirements");
  revalidatePath("/projects");
}
