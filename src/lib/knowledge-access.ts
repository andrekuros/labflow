import "server-only";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { viewableProjectIds } from "@/lib/projects";

export type ArticleAccess = {
  id: string;
  projectId: string | null;
  authorId: string | null;
  externalSource: string | null;
};

export async function canViewArticle(user: SessionUser, article: ArticleAccess): Promise<boolean> {
  if (!(await hasPermission(user, "knowledge:view"))) return false;
  if (!article.projectId) return true;
  const ids = await viewableProjectIds(user);
  return ids.includes(article.projectId);
}

export async function canEditArticle(user: SessionUser, article: ArticleAccess): Promise<boolean> {
  if (article.externalSource === "nextcloud") return false;
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
  return { OR: [{ projectId: null }, { projectId: { in: ids } }] };
}
