import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import {
  PROJECT_BUNDLE_FORMAT_DOC,
  PROJECT_BUNDLE_FORMAT_DOC_TITLE,
} from "@/lib/data-transfer/format-doc";

const DOC_TAGS = "labflow-schema,json,projeto,import,export,ia,data-transfer";

/** Garante artigo do formato de pacote de projeto na base de conhecimento. Idempotente. */
export async function ensureProjectBundleFormatArticle() {
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { title: PROJECT_BUNDLE_FORMAT_DOC_TITLE, projectId: null },
  });
  if (existing) {
    if (existing.content !== PROJECT_BUNDLE_FORMAT_DOC) {
      await prisma.knowledgeArticle.update({
        where: { id: existing.id },
        data: {
          content: PROJECT_BUNDLE_FORMAT_DOC,
          tags: DOC_TAGS,
          externalSource: "system",
          kind: "page",
          extractedText: PROJECT_BUNDLE_FORMAT_DOC,
        },
      });
      await emit({
        type: "article.updated",
        targetId: existing.id,
        payload: {
          id: existing.id,
          title: PROJECT_BUNDLE_FORMAT_DOC_TITLE,
          content: PROJECT_BUNDLE_FORMAT_DOC,
        },
      });
    }
    return existing.id;
  }

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: PROJECT_BUNDLE_FORMAT_DOC_TITLE,
      content: PROJECT_BUNDLE_FORMAT_DOC,
      tags: DOC_TAGS,
      projectId: null,
      kind: "page",
      externalSource: "system",
      extractedText: PROJECT_BUNDLE_FORMAT_DOC,
    },
  });
  await emit({
    type: "article.created",
    targetId: article.id,
    payload: {
      id: article.id,
      title: PROJECT_BUNDLE_FORMAT_DOC_TITLE,
      content: PROJECT_BUNDLE_FORMAT_DOC,
    },
  });
  return article.id;
}
