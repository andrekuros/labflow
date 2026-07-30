import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { canViewArticle, canEditArticle, canDeleteArticle, getAdminOnlyFolders } from "@/lib/knowledge-access";
import { articleIsAdminOnly } from "@/plugins/knowledge/folder-path";
import { getNextcloudSettings, buildNextcloudFileUrl } from "@/plugins/knowledge/nextcloud-config";
import { getArticleBacklinksAction } from "@/plugins/knowledge/link-actions";
import { ArticleEditor } from "@/components/knowledge/article-editor";
import { ArticleBacklinks } from "@/components/knowledge/article-backlinks";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, include: { author: true } });
  if (!article) notFound();
  if (!(await canViewArticle(session, article))) notFound();

  const [canEdit, canDelete, backlinks, ncCfg] = await Promise.all([
    canEditArticle(session, article),
    canDeleteArticle(session, article),
    getArticleBacklinksAction(id),
    article.externalSource === "nextcloud" ? getNextcloudSettings() : Promise.resolve(null),
  ]);

  const nextcloudFileUrl =
    article.externalSource === "nextcloud" && article.externalPath && ncCfg
      ? buildNextcloudFileUrl(ncCfg, article.externalPath)
      : null;

  const adminOnly = articleIsAdminOnly(article, getAdminOnlyFolders());

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/knowledge" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Conhecimento
      </Link>
      <ArticleEditor
        canEdit={canEdit}
        canDelete={canDelete}
        externalSource={article.externalSource}
        nextcloudFileUrl={nextcloudFileUrl}
        adminOnly={adminOnly}
        article={{
          id: article.id,
          title: article.title,
          content: article.content,
          tags: article.tags,
          author: article.author?.name ?? (article.externalSource === "nextcloud" ? "Nextcloud" : "Desconhecido"),
          updatedAt: article.updatedAt.toISOString(),
        }}
      />
      <ArticleBacklinks backlinks={backlinks} />
    </div>
  );
}
