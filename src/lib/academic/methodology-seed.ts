import "server-only";

import { prisma } from "@/lib/db";
import { ingest } from "@/lib/ai/rag";
import {
  METHODOLOGY_ARTICLE_TITLE,
  methodologyArticleContent,
} from "@/lib/academic/methodology-knowledge";

/** Garante artigo de metodologia na base de conhecimento e no RAG (idempotente). */
export async function ensureAcademicMethodologyArticle() {
  const content = methodologyArticleContent();
  const tags = "academic,metodologia,pesquisa,guia";

  const existing = await prisma.knowledgeArticle.findFirst({
    where: { title: METHODOLOGY_ARTICLE_TITLE },
  });

  const article = existing
    ? await prisma.knowledgeArticle.update({
        where: { id: existing.id },
        data: { content, tags },
      })
    : await prisma.knowledgeArticle.create({
        data: { title: METHODOLOGY_ARTICLE_TITLE, content, tags },
      });

  await ingest({
    sourceType: "article",
    sourceId: article.id,
    text: `${article.title}\n${article.content}`,
  });
}
