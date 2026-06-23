import "server-only";
import { prisma } from "@/lib/db";
import { ARTIFACTS_FORMAT_DOC } from "@/lib/artifacts/format-doc";
import { emit } from "@/lib/events";

const DOC_TITLE = "Formato JSON de artefatos LabFlow";
const DOC_TAGS = "labflow-schema,json,artefatos,import,export,ia";

export async function ensureArtifactsFormatArticle() {
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { title: DOC_TITLE, projectId: null },
  });
  if (existing) {
    if (existing.content !== ARTIFACTS_FORMAT_DOC) {
      await prisma.knowledgeArticle.update({
        where: { id: existing.id },
        data: { content: ARTIFACTS_FORMAT_DOC, tags: DOC_TAGS },
      });
      await emit({ type: "article.updated", payload: { id: existing.id, title: DOC_TITLE, content: ARTIFACTS_FORMAT_DOC } });
    }
    return existing.id;
  }

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: DOC_TITLE,
      content: ARTIFACTS_FORMAT_DOC,
      tags: DOC_TAGS,
      projectId: null,
    },
  });
  await emit({ type: "article.created", payload: { id: article.id, title: DOC_TITLE, content: ARTIFACTS_FORMAT_DOC } });
  return article.id;
}
