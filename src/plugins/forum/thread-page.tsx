import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui";
import { ThreadView } from "@/components/forum/thread-view";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      channel: { include: { project: true } },
      posts: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/forum" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Foruns
      </Link>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-muted">#{thread.channel.name}</span>
        {thread.channel.project && <Badge color={thread.channel.project.color}>{thread.channel.project.key}</Badge>}
        {thread.status === "resolved" && <Badge color="#22c55e">Resolvido</Badge>}
      </div>
      <h1 className="mb-5 text-2xl font-semibold">{thread.title}</h1>

      <ThreadView
        threadId={thread.id}
        initialPosts={thread.posts.map((p) => ({
          id: p.id,
          content: p.content,
          createdAt: p.createdAt.toISOString(),
          authorName: p.author?.name ?? "Desconhecido",
          authorColor: p.author?.avatarColor ?? "#6366f1",
        }))}
      />
    </div>
  );
}
