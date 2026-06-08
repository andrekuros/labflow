import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, Badge, Avatar, PageHeader } from "@/components/ui";
import { formatDate, daysUntil } from "@/lib/utils";
import { CalendarClock, CheckCircle2, ListTodo, PackageCheck } from "lucide-react";
import { PluginSlot } from "@/components/plugin-slot";

export default async function DashboardPage() {
  const session = await requireUser();

  const [myTasks, openTasks, doneTasks, deliverables, upcoming, recent] = await Promise.all([
    prisma.task.findMany({
      where: { assignees: { some: { id: session.id } }, status: { not: "done" } },
      include: { project: true, labels: true },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
    }),
    prisma.task.count({ where: { status: { not: "done" } } }),
    prisma.task.count({ where: { status: "done" } }),
    prisma.deliverable.count({ where: { status: { notIn: ["accepted", "rejected"] } } }),
    prisma.deliverable.findMany({
      where: { dueDate: { not: null }, status: { notIn: ["accepted", "rejected"] } },
      include: { project: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const actorIds = [...new Set(recent.map((r) => r.actorId).filter(Boolean) as string[])];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } } });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  return (
    <div>
      <PageHeader
        title={`Ola, ${session.name.split(" ")[0]}`}
        description="Visao geral do laboratorio e das suas atividades."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<ListTodo size={18} />} label="Tarefas abertas" value={openTasks} />
        <Stat icon={<CheckCircle2 size={18} />} label="Concluidas" value={doneTasks} />
        <Stat icon={<PackageCheck size={18} />} label="Entregaveis ativos" value={deliverables} />
        <Stat icon={<CalendarClock size={18} />} label="Minhas tarefas" value={myTasks.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Minhas tarefas</h2>
          <div className="space-y-2">
            {myTasks.length === 0 && <p className="text-sm text-muted">Nenhuma tarefa atribuida a voce.</p>}
            {myTasks.map((t) => {
              const d = daysUntil(t.dueDate);
              return (
                <Link
                  key={t.id}
                  href={`/board?project=${t.projectId}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface2/50 px-3 py-2 transition hover:bg-surface2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{t.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge color={t.project.color}>{t.project.key}</Badge>
                      {t.labels.map((l) => (
                        <Badge key={l.id} color={l.color}>{l.name}</Badge>
                      ))}
                    </div>
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
        </Card>

        <div className="space-y-6">
          <PluginSlot slot="dashboard.widgets" />
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Proximos prazos</h2>
            <div className="space-y-2">
              {upcoming.length === 0 && <p className="text-sm text-muted">Sem prazos proximos.</p>}
              {upcoming.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(d.dueDate)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Atividade recente</h2>
            <div className="space-y-3">
              {recent.map((r) => {
                const actor = r.actorId ? actorMap.get(r.actorId) : null;
                return (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {actor ? <Avatar name={actor.name} color={actor.avatarColor} /> : <div className="h-7 w-7" />}
                    <div className="min-w-0">
                      <p className="truncate text-fg">{labelForEvent(r.type)}</p>
                      <p className="text-muted">{formatDate(r.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {recent.length === 0 && <p className="text-sm text-muted">Sem atividade ainda.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">{icon}</div>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </Card>
  );
}

function labelForEvent(type: string) {
  const map: Record<string, string> = {
    "task.created": "Tarefa criada",
    "task.updated": "Tarefa atualizada",
    "task.moved": "Tarefa movida no Kanban",
    "deliverable.created": "Entregavel criado",
    "deliverable.updated": "Entregavel atualizado",
    "requirement.created": "Requisito criado",
    "article.created": "Artigo de conhecimento criado",
    "article.updated": "Artigo atualizado",
    "thread.created": "Novo topico no forum",
    "post.created": "Nova mensagem no forum",
    "project.created": "Projeto criado",
  };
  return map[type] ?? type;
}
