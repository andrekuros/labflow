import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  KanbanSquare,
  FolderKanban,
  ListTodo,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, Badge, Avatar, LinkButton } from "@/components/ui";
import { ROLES } from "@/components/team/team-client";
import { formatDate, daysUntil } from "@/lib/utils";
import { PRIORITIES } from "@/components/board/types";

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Revisao",
  done: "Concluido",
};

const PROJECT_ROLE: Record<string, string> = {
  lead: "Lider",
  contributor: "Contribuidor",
  viewer: "Leitor",
};

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: { include: { project: true }, orderBy: { project: { name: "asc" } } },
      assignedTasks: {
        include: { project: true, labels: true, sprint: true },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      },
      _count: { select: { createdTasks: true, articles: true, posts: true } },
    },
  });

  if (!user) notFound();

  const activeTasks = user.assignedTasks.filter((t) => t.status !== "done");
  const doneTasks = user.assignedTasks.filter((t) => t.status === "done");
  const overdue = activeTasks.filter((t) => {
    const d = daysUntil(t.dueDate);
    return d !== null && d < 0;
  });
  const inProgress = user.assignedTasks.filter((t) => t.status === "in_progress");

  const byStatus = Object.keys(STATUS_LABEL).map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: user.assignedTasks.filter((t) => t.status === status).length,
  }));

  return (
    <div>
      <Link href="/team" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Equipe
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-5">
        <Avatar name={user.name} color={user.avatarColor} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {[user.title, ROLES[user.role] ?? user.role, user.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <LinkButton href={`/board?assignee=${user.id}`}>
              <KanbanSquare size={16} /> Ver no Kanban
            </LinkButton>
          </div>
          <p className="text-xs text-muted">
            Membro desde {formatDate(user.createdAt)} · {user._count.createdTasks} tarefas criadas ·{" "}
            {user._count.articles} artigos · {user._count.posts} posts no forum
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={<ListTodo size={16} />} label="Tarefas ativas" value={activeTasks.length} />
        <Stat icon={<Clock size={16} />} label="Em andamento" value={inProgress.length} />
        <Stat icon={<AlertCircle size={16} />} label="Atrasadas" value={overdue.length} highlight={overdue.length > 0} />
        <Stat icon={<CheckCircle2 size={16} />} label="Concluidas" value={doneTasks.length} />
        <Stat icon={<FolderKanban size={16} />} label="Projetos" value={user.memberships.length} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {byStatus.map((s) => (
          <Badge key={s.status} className="bg-surface2 text-muted">
            {s.label}: {s.count}
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Tarefas atribuidas ({user.assignedTasks.length})</h2>
            {user.assignedTasks.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma tarefa atribuida.</p>
            ) : (
              <div className="space-y-2">
                {user.assignedTasks.map((t) => {
                  const d = daysUntil(t.dueDate);
                  const prio = PRIORITIES[t.priority];
                  return (
                    <Link
                      key={t.id}
                      href={`/board?assignee=${user.id}&project=${t.projectId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 transition hover:bg-surface2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge color={t.project.color}>{t.project.key}</Badge>
                          <Badge className="bg-surface2 text-muted">{STATUS_LABEL[t.status] ?? t.status}</Badge>
                          {prio && (
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prio.color }} title={prio.label} />
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium">{t.title}</p>
                        {t.sprint && <p className="text-xs text-muted">Sprint: {t.sprint.name}</p>}
                        {t.labels.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {t.labels.map((l) => (
                              <Badge key={l.id} color={l.color}>{l.name}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {t.dueDate && (
                        <span
                          className={`shrink-0 text-xs ${
                            d !== null && d < 0 ? "text-red-400" : d !== null && d <= 3 ? "text-amber-400" : "text-muted"
                          }`}
                        >
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Projetos ({user.memberships.length})</h2>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted">Nao participa de nenhum projeto.</p>
            ) : (
              <div className="space-y-2">
                {user.memberships.map((m) => (
                  <Link
                    key={m.id}
                    href={`/projects/${m.projectId}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition hover:bg-surface2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.project.color }} />
                      <div>
                        <p className="text-sm font-medium">{m.project.name}</p>
                        <p className="text-xs text-muted">{m.project.key}</p>
                      </div>
                    </div>
                    <Badge className="bg-surface2 text-muted">{PROJECT_ROLE[m.role] ?? m.role}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`flex items-center gap-3 p-4 ${highlight ? "border-red-500/40" : ""}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">{icon}</div>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </Card>
  );
}
