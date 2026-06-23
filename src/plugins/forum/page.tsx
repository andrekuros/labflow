import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds } from "@/lib/projects";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { NewChannelButton, NewThreadButton } from "@/components/forum/forum-client";
import { MessageSquare, CheckCircle2, Pin } from "lucide-react";

export default async function ForumPage() {
  const session = await requireUser();
  const ids = await viewableProjectIds(session);

  const channels = await prisma.channel.findMany({
    where: { OR: [{ projectId: null }, { projectId: { in: ids } }] },
    include: {
      project: true,
      threads: {
        include: { author: true, _count: { select: { posts: true } } },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Foruns"
        description="Discussoes por projeto e topico. Tudo aqui alimenta a base de conhecimento."
        actions={
          <div className="flex gap-2">
            <NewChannelButton projects={(await prisma.project.findMany({ where: { id: { in: ids } } })).map((p) => ({ id: p.id, key: p.key, name: p.name }))} />
            <NewThreadButton channels={channels.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        }
      />

      {channels.length === 0 ? (
        <EmptyState title="Nenhum canal" description="Crie um canal para iniciar as discussoes." />
      ) : (
        <div className="space-y-6">
          {channels.map((c) => (
            <div key={c.id}>
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare size={16} className="text-muted" />
                <h2 className="font-semibold">#{c.name}</h2>
                {c.project && <Badge color={c.project.color}>{c.project.key}</Badge>}
                {c.description && <span className="text-xs text-muted">- {c.description}</span>}
              </div>
              <Card className="divide-y divide-border">
                {c.threads.length === 0 && <p className="p-4 text-sm text-muted">Nenhum topico ainda.</p>}
                {c.threads.map((t) => (
                  <Link key={t.id} href={`/forum/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface2">
                    <div className="flex items-center gap-2">
                      {t.pinned && <Pin size={13} className="text-amber-400" />}
                      {t.status === "resolved" && <CheckCircle2 size={14} className="text-emerald-400" />}
                      <span className="text-sm">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>{t._count.posts} msgs</span>
                      <span>{t.author?.name?.split(" ")[0]}</span>
                      <span>{formatDate(t.updatedAt)}</span>
                    </div>
                  </Link>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
