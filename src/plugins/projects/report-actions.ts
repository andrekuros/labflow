"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canViewProject, canWriteProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { hasPermission } from "@/lib/rbac";
import {
  fetchProjectReportData,
  generateProjectDocumentMarkdown,
  knowledgeDocumentTitle,
} from "@/lib/projects/project-document";
import { generateProjectDocumentPdf } from "@/lib/projects/project-document-pdf";
import type { ProjectReportConfig, ProjectReportData } from "@/lib/projects/project-document-types";
import { normalizeReportConfig } from "@/lib/projects/project-document-types";
import { serializeFrontmatter } from "@/plugins/knowledge/frontmatter";
import { parentFolderFromPath } from "@/plugins/knowledge/folder-map";
import { getVaultConnection, writeVaultMarkdown, generatedDocPath, ensureProjectVaultFromId } from "@/lib/knowledge/vault";
import { articleIngestText } from "@/lib/knowledge/files";

async function requireView(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canViewProject(session, projectId))) throw new Error("Sem permissao");
  return session;
}

export async function loadProjectReportDataAction(projectId: string): Promise<ProjectReportData> {
  await requireView(projectId);
  return fetchProjectReportData(projectId);
}

export async function previewProjectDocumentAction(
  projectId: string,
  config: ProjectReportConfig,
): Promise<string> {
  await requireView(projectId);
  const data = await fetchProjectReportData(projectId);
  return generateProjectDocumentMarkdown(data, normalizeReportConfig(config));
}

export async function generateProjectDocumentPdfAction(
  projectId: string,
  config: ProjectReportConfig,
  markdown?: string,
): Promise<{ base64: string; filename: string }> {
  await requireView(projectId);
  const data = await fetchProjectReportData(projectId);
  const buffer = await generateProjectDocumentPdf(data, normalizeReportConfig(config), markdown);
  const filename = `labflow-${data.project.key.toLowerCase()}-documentacao.pdf`;
  return { base64: buffer.toString("base64"), filename };
}

export async function publishProjectDocumentToKnowledgeAction(
  projectId: string,
  config: ProjectReportConfig,
  markdown?: string,
): Promise<{ articleId: string; created: boolean; title: string }> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, projectId))) throw new Error("Sem permissao de escrita no projeto");
  if (!(await hasPermission(session, "knowledge:create", projectId))) {
    throw new Error("Sem permissao para publicar na base de conhecimento");
  }

  const data = await fetchProjectReportData(projectId);
  const normalized = normalizeReportConfig(config);
  const content = markdown?.trim() || generateProjectDocumentMarkdown(data, normalized);
  const title = knowledgeDocumentTitle(data.project.key);
  const tags = `project-report,${data.project.key.toLowerCase()},documentacao,generated`;
  const markdownFile = serializeFrontmatter(
    {
      title,
      tags: tags.split(","),
      project: data.project.key,
      projectId,
      status: "active",
    },
    content,
  );

  const conn = await getVaultConnection();
  let vaultPath: string | null = null;
  let etag: string | null = null;
  if (conn) {
    await ensureProjectVaultFromId(projectId);
    vaultPath = generatedDocPath(data.project.kind, data.project.key, title);
    etag = await writeVaultMarkdown(conn, vaultPath, markdownFile);
  }

  let articleId: string;
  let created = false;

  const existing =
    (data.knowledgeArticleId
      ? await prisma.knowledgeArticle.findUnique({ where: { id: data.knowledgeArticleId } })
      : null) ??
    (vaultPath
      ? await prisma.knowledgeArticle.findUnique({ where: { externalPath: vaultPath } })
      : null);

  const vaultFields = vaultPath
    ? {
        externalSource: "nextcloud" as const,
        externalPath: vaultPath,
        externalFolder: parentFolderFromPath(vaultPath) || null,
        externalEtag: etag,
        externalSyncedAt: new Date(),
        fileName: vaultPath.split("/").pop() ?? null,
        mimeType: "text/markdown",
      }
    : {};

  if (existing) {
    const updated = await prisma.knowledgeArticle.update({
      where: { id: existing.id },
      data: {
        title,
        content,
        tags,
        kind: "page",
        extractedText: content,
        projectId,
        ...vaultFields,
      },
    });
    articleId = updated.id;
    await emit({
      type: "article.updated",
      actorId: session.id,
      projectId,
      targetId: articleId,
      payload: { id: articleId, title, content: articleIngestText(updated) },
    });
  } else {
    const createdRow = await prisma.knowledgeArticle.create({
      data: {
        title,
        content,
        tags,
        projectId,
        authorId: session.id,
        kind: "page",
        extractedText: content,
        ...vaultFields,
      },
    });
    articleId = createdRow.id;
    created = true;
    await emit({
      type: "article.created",
      actorId: session.id,
      projectId,
      targetId: articleId,
      payload: { id: articleId, title, content: articleIngestText(createdRow) },
    });
  }

  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${articleId}`);
  revalidatePath(`/projects/${projectId}`);
  return { articleId, created, title };
}
