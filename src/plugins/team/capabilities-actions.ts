"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isKnowledgeAdmin } from "@/lib/knowledge-access";
import { aiEnabled } from "@/lib/ai/provider";
import { emit } from "@/lib/events";
import {
  fetchLabTeamCapabilityData,
  generateLabCapabilitiesMarkdown,
  mergeAiEnrichment,
  LAB_CAPABILITIES_TITLE,
} from "@/lib/team/capabilities";
import { enrichLabCapabilitiesWithAi } from "@/lib/ai/team-capabilities";

export async function getLabCapabilitiesArticleAction(): Promise<{
  articleId: string | null;
  updatedAt: string | null;
}> {
  const session = await getSession();
  if (!session || !isKnowledgeAdmin(session)) {
    return { articleId: null, updatedAt: null };
  }
  const article = await prisma.knowledgeArticle.findFirst({
    where: { title: LAB_CAPABILITIES_TITLE, projectId: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  return {
    articleId: article?.id ?? null,
    updatedAt: article?.updatedAt.toISOString() ?? null,
  };
}

export async function publishLabTeamCapabilitiesAction(): Promise<
  { articleId: string; created: boolean; title: string } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!isKnowledgeAdmin(session)) return { error: "Apenas administradores podem gerar o mapa de capacidades" };

  try {
    const data = await fetchLabTeamCapabilityData();
    let content = generateLabCapabilitiesMarkdown(data);

    if (await aiEnabled()) {
      const enrichments = await enrichLabCapabilitiesWithAi(data);
      content = mergeAiEnrichment(content, enrichments);
    }

    const tags = "team-capabilities,admin-only,labflow-internal";
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { title: LAB_CAPABILITIES_TITLE, projectId: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    let articleId: string;
    let created = false;

    if (existing) {
      const updated = await prisma.knowledgeArticle.update({
        where: { id: existing.id },
        data: {
          content,
          tags,
          externalFolder: "admin",
          authorId: session.id,
        },
      });
      articleId = updated.id;
      await emit({
        type: "article.updated",
        actorId: session.id,
        targetId: articleId,
        payload: { id: articleId, title: LAB_CAPABILITIES_TITLE, content },
      });
    } else {
      const createdRow = await prisma.knowledgeArticle.create({
        data: {
          title: LAB_CAPABILITIES_TITLE,
          content,
          tags,
          projectId: null,
          authorId: session.id,
          externalFolder: "admin",
        },
      });
      articleId = createdRow.id;
      created = true;
      await emit({
        type: "article.created",
        actorId: session.id,
        targetId: articleId,
        payload: { id: articleId, title: LAB_CAPABILITIES_TITLE, content },
      });
    }

    revalidatePath("/knowledge");
    revalidatePath(`/knowledge/${articleId}`);
    revalidatePath("/team");
    revalidatePath("/settings");

    return { articleId, created, title: LAB_CAPABILITIES_TITLE };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao publicar mapa de capacidades" };
  }
}
