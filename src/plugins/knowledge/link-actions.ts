"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject, requirePermission } from "@/lib/rbac";
import { canViewArticle, articleVisibilityWhere } from "@/lib/knowledge-access";
import type { SessionUser } from "@/lib/auth";
import { getVaultConnection, folderForProjectWrite } from "@/lib/knowledge/vault";
import { ingestVaultFile } from "@/lib/knowledge/ingest-file";
import { attachmentEntitySlug, vaultAttachmentFolder } from "@/lib/knowledge/vault-layout";

export type LinkTargetType = "task" | "deliverable" | "requirement" | "project" | "verification";

export type KnowledgeLinkItem = {
  id: string;
  articleId: string;
  title: string;
  externalSource: string | null;
  kind: string;
  fileName: string | null;
};

async function resolveTargetMeta(
  targetType: LinkTargetType,
  targetId: string,
): Promise<{ projectId: string; title: string } | null> {
  switch (targetType) {
    case "task": {
      const t = await prisma.task.findUnique({ where: { id: targetId }, select: { projectId: true, title: true } });
      return t ? { projectId: t.projectId, title: t.title } : null;
    }
    case "deliverable": {
      const d = await prisma.deliverable.findUnique({ where: { id: targetId }, select: { projectId: true, name: true } });
      return d ? { projectId: d.projectId, title: d.name } : null;
    }
    case "requirement": {
      const r = await prisma.requirement.findUnique({
        where: { id: targetId },
        select: { projectId: true, code: true, title: true },
      });
      return r ? { projectId: r.projectId, title: r.code ? `${r.code} ${r.title}` : r.title } : null;
    }
    case "project": {
      const p = await prisma.project.findUnique({ where: { id: targetId }, select: { id: true, name: true } });
      return p ? { projectId: p.id, title: p.name } : null;
    }
    case "verification": {
      const v = await prisma.verificationCase.findUnique({
        where: { id: targetId },
        select: { projectId: true, name: true },
      });
      return v ? { projectId: v.projectId, title: v.name } : null;
    }
  }
}

async function resolveTargetProjectId(targetType: LinkTargetType, targetId: string): Promise<string | null> {
  const meta = await resolveTargetMeta(targetType, targetId);
  return meta?.projectId ?? null;
}

async function assertCanLinkTarget(session: SessionUser, targetType: LinkTargetType, targetId: string) {
  const projectId = await resolveTargetProjectId(targetType, targetId);
  if (!projectId) throw new Error("Entidade nao encontrada.");
  if (!(await canWriteProject(session, projectId))) {
    throw new Error("Sem permissao de escrita neste projeto.");
  }
  return projectId;
}

async function upsertLink(input: {
  articleId: string;
  targetType: LinkTargetType;
  targetId: string;
  createdBy: string;
}) {
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
      createdBy: input.createdBy,
    },
    update: {},
  });
}

function revalidateLinkedPaths(articleId?: string) {
  revalidatePath("/board");
  revalidatePath("/deliverables");
  revalidatePath("/requirements");
  revalidatePath("/planning");
  revalidatePath("/projects");
  revalidatePath("/verification");
  revalidatePath("/knowledge");
  if (articleId) revalidatePath(`/knowledge/${articleId}`);
}

export async function getKnowledgeLinksAction(targetType: LinkTargetType, targetId: string): Promise<KnowledgeLinkItem[]> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const links = await prisma.knowledgeLink.findMany({
    where: { targetType, targetId },
    include: {
      article: {
        select: { id: true, title: true, externalSource: true, projectId: true, authorId: true, kind: true, fileName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const visible: KnowledgeLinkItem[] = [];
  for (const l of links) {
    if (await canViewArticle(session, l.article)) {
      visible.push({
        id: l.id,
        articleId: l.article.id,
        title: l.article.title,
        externalSource: l.article.externalSource,
        kind: l.article.kind,
        fileName: l.article.fileName,
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

  const projectId = await assertCanLinkTarget(session, input.targetType, input.targetId);
  await upsertLink({ ...input, createdBy: session.id });
  if (input.targetType !== "project") {
    await upsertLink({
      articleId: input.articleId,
      targetType: "project",
      targetId: projectId,
      createdBy: session.id,
    });
  }

  revalidateLinkedPaths(input.articleId);
}

export async function unlinkArticleAction(linkId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const link = await prisma.knowledgeLink.findUnique({ where: { id: linkId } });
  if (!link) throw new Error("Vinculo nao encontrado.");

  await assertCanLinkTarget(session, link.targetType as LinkTargetType, link.targetId);

  await prisma.knowledgeLink.delete({ where: { id: linkId } });
  revalidateLinkedPaths(link.articleId);
}

export async function attachFileToEntityAction(formData: FormData): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  try {
    await requirePermission("knowledge:create");
  } catch {
    return { error: "Sem permissao para enviar arquivos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo." };

  const targetType = String(formData.get("targetType") ?? "") as LinkTargetType;
  const targetId = String(formData.get("targetId") ?? "").trim();
  const allowed: LinkTargetType[] = ["task", "deliverable", "requirement", "project", "verification"];
  if (!allowed.includes(targetType) || !targetId) return { error: "Alvo invalido." };

  let projectId: string;
  let title: string;
  try {
    const meta = await resolveTargetMeta(targetType, targetId);
    if (!meta) return { error: "Entidade nao encontrada." };
    if (!(await canWriteProject(session, meta.projectId))) {
      return { error: "Sem permissao de escrita neste projeto." };
    }
    projectId = meta.projectId;
    title = meta.title;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao anexar." };
  }

  const conn = await getVaultConnection();
  if (!conn) return { error: "Nextcloud precisa estar habilitado para enviar arquivos." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true, name: true, kind: true },
  });
  if (!project) return { error: "Projeto nao encontrado." };

  const slug = targetType === "project" ? undefined : attachmentEntitySlug(title, targetId);
  const preferred = vaultAttachmentFolder(project.kind, project.key, targetType, slug);

  try {
    const folder = await folderForProjectWrite(conn, project, preferred);
    const result = await ingestVaultFile({
      sessionId: session.id,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      folder,
      projectId,
      conn,
    });
    if ("error" in result) return result;

    await upsertLink({
      articleId: result.id,
      targetType,
      targetId,
      createdBy: session.id,
    });
    if (targetType !== "project") {
      await upsertLink({
        articleId: result.id,
        targetType: "project",
        targetId: projectId,
        createdBy: session.id,
      });
    }

    revalidateLinkedPaths(result.id);
    revalidatePath(`/projects/${projectId}`);
    return { id: result.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao enviar o arquivo." };
  }
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
    } else if (type === "project") {
      const p = await prisma.project.findUnique({ where: { id: link.targetId } });
      if (p) {
        result.push({
          id: link.id,
          targetType: type,
          targetId: p.id,
          title: `${p.key} — ${p.name}`,
          projectKey: p.key,
          projectColor: p.color,
          href: `/projects/${p.id}?tab=files`,
        });
      }
    } else if (type === "verification") {
      const v = await prisma.verificationCase.findUnique({
        where: { id: link.targetId },
        include: { project: true },
      });
      if (v) {
        result.push({
          id: link.id,
          targetType: type,
          targetId: v.id,
          title: v.name,
          projectKey: v.project.key,
          projectColor: v.project.color,
          href: "/verification",
        });
      }
    }
  }

  return result;
}
