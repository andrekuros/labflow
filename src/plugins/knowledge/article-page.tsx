import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ArticleEditor } from "@/components/knowledge/article-editor";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, include: { author: true } });
  if (!article) notFound();

  const canEdit = session.role === "admin" || article.authorId === session.id;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/knowledge" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Conhecimento
      </Link>
      <ArticleEditor
        canEdit={canEdit}
        article={{
          id: article.id,
          title: article.title,
          content: article.content,
          tags: article.tags,
          author: article.author?.name ?? "Desconhecido",
          updatedAt: article.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}
