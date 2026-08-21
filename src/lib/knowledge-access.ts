import "server-only";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { viewableProjectIds } from "@/lib/projects";
import { getPluginSettings } from "@/plugins/registry";
import { prisma } from "@/lib/db";
import { articleIsAdminOnly } from "@/plugins/knowledge/folder-path";
import type { SearchHit } from "@/lib/ai/rag";

const DEFAULT_ADMIN_ONLY_FOLDERS = ["admin"];

export type ArticleAccess = {
  id: string;
  projectId: string | null;
  authorId: string | null;
  externalSource: string | null;
  externalPath?: string | null;
  externalFolder?: string | null;
  kind?: string | null;
};

import { isAdminUser } from "@/lib/user-access";

export function isKnowledgeAdmin(user: SessionUser): boolean {
  return isAdminUser(user);
}

export function getAdminOnlyFolders(): string[] {
  const raw = getPluginSettings("knowledge").nextcloudAdminOnlyFolders;
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [...DEFAULT_ADMIN_ONLY_FOLDERS];
}

function adminFolderExcludeWhere(folders: string[]) {
  if (folders.length === 0) return null;
  const pathMatch = folders.flatMap((folder) => {
    const f = folder.replace(/^\/+|\/+$/g, "");
    if (!f) return [];
    return [
      { externalFolder: f },
      { externalFolder: { startsWith: `${f}/` } },
      { externalPath: { startsWith: `${f}/` } },
      { externalPath: f },
    ];
  });
  if (pathMatch.length === 0) return null;
  return { NOT: { OR: pathMatch } };
}

export async function canViewArticle(user: SessionUser, article: ArticleAccess): Promise<boolean> {
  if (!(await hasPermission(user, "knowledge:view"))) return false;
  if (!isKnowledgeAdmin(user) && articleIsAdminOnly(article, getAdminOnlyFolders())) return false;
  if (!article.projectId) return true;
  const ids = await viewableProjectIds(user);
  return ids.includes(article.projectId);
}

export async function canEditArticle(user: SessionUser, article: ArticleAccess): Promise<boolean> {
  if (article.kind === "file") return false;
  if (!(await canViewArticle(user, article))) return false;
  if (await hasPermission(user, "knowledge:edit")) return true;
  return article.authorId === user.id;
}

export async function canDeleteArticle(user: SessionUser, article: ArticleAccess): Promise<boolean> {
  if (article.externalSource === "nextcloud") return false;
  if (!(await canViewArticle(user, article))) return false;
  if (await hasPermission(user, "knowledge:delete")) return true;
  return user.role === "admin";
}

export async function assertCanViewArticle(user: SessionUser, article: ArticleAccess): Promise<void> {
  if (!(await canViewArticle(user, article))) {
    throw new Error("Sem permissao para visualizar este artigo.");
  }
}

export async function assertCanEditArticle(user: SessionUser, article: ArticleAccess): Promise<void> {
  if (!(await canEditArticle(user, article))) {
    throw new Error("Sem permissao para editar este artigo.");
  }
}

export async function assertCanDeleteArticle(user: SessionUser, article: ArticleAccess): Promise<void> {
  if (!(await canDeleteArticle(user, article))) {
    throw new Error("Sem permissao para excluir este artigo.");
  }
}

/** Prisma where clause for articles visible to the user. */
export async function articleVisibilityWhere(user: SessionUser) {
  const ids = await viewableProjectIds(user);
  const base = { OR: [{ projectId: null }, { projectId: { in: ids } }] };
  if (isKnowledgeAdmin(user)) return base;
  const adminExclude = adminFolderExcludeWhere(getAdminOnlyFolders());
  if (!adminExclude) return base;
  return { AND: [base, adminExclude] };
}

/** Remove RAG hits from admin-only or out-of-scope articles. */
export async function filterRagHitsForUser(hits: SearchHit[], user: SessionUser | null): Promise<SearchHit[]> {
  const articleIds = [...new Set(hits.filter((h) => h.sourceType === "article").map((h) => h.sourceId))];
  if (articleIds.length === 0) return hits;

  const articles = await prisma.knowledgeArticle.findMany({
    where: { id: { in: articleIds } },
    select: { id: true, externalPath: true, externalFolder: true, projectId: true },
  });
  const byId = new Map(articles.map((a) => [a.id, a]));
  const adminFolders = getAdminOnlyFolders();
  const viewable = user ? await viewableProjectIds(user) : [];
  const isAdmin = user ? isKnowledgeAdmin(user) : false;

  return hits.filter((h) => {
    if (h.sourceType !== "article") {
      if (!user) return true;
      if (!h.projectId) return true;
      return isAdmin || viewable.includes(h.projectId);
    }
    const article = byId.get(h.sourceId);
    if (!article) return false;
    if (!isAdmin && articleIsAdminOnly(article, adminFolders)) return false;
    if (article.projectId && !isAdmin && !viewable.includes(article.projectId)) return false;
    return true;
  });
}
