import Link from "next/link";
import { requireUser, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, Badge, Avatar, PageHeader } from "@/components/ui";
import { formatDate, daysUntil } from "@/lib/utils";
import { labelForEvent } from "@/lib/activity-log/constants";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flag,
  ListTodo,
  PackageCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PluginSlot } from "@/components/plugin-slot";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { getPortfolioOverview } from "@/lib/portfolio";
import { byHealthThenOverdue, formatDelta, HEALTH_META } from "@/lib/portfolio-meta";
import { WorkspaceScopeBar } from "@/components/workspace-scope-bar";

const PERIOD_DAYS = 14;
const PORTFOLIO_PREVIEW = 6;

export default async function DashboardPage() {
  const session = await requireUser();
  const scope = await resolveWorkspaceScope(session);

  const now = new Date();
  const from = new Date(now.getTime() - PERIOD_DAYS * 86400000);
  // Everything below counts only the projects in the active workspace context,
  // so the topbar filters govern the dashboard the same way they govern /projects.
  const ids = scope.projectIds;
  const inScope = { in: ids };
  const empty = ids.length === 0;

  const [portfolio, myTasks, upcomingDeliverables, upcomingMilestones, recent, canSeeReports] =
    await Promise.all([
      empty
        ? Promise.resolve(null)
        : getPortfolioOverview(from, now, { projectIds: ids }),
      empty
        ? Promise.resolve([])
        : prisma.task.findMany({
            where: {
              assignees: { some: { id: session.id } },
              status: { not: "done" },
              projectId: inScope,
            },
            include: { project: true, labels: true },
            orderBy: [{ dueDate: "asc" }],
            take: 8,
          }),
      empty
        ? Promise.resolve([])
        : prisma.deliverable.findMany({
            where: {
              dueDate: { not: null },
              status: { notIn: ["accepted", "rejected"] },
              projectId: inScope,
            },
            include: { project: true },
            orderBy: { dueDate: "asc" },
            take: 5,
          }),
      empty
        ? Promise.resolve([])
        : prisma.milestone.findMany({
            where: { date: { not: null }, status: { not: "reached" }, projectId: inScope },
            include: { project: true },
            orderBy: { date: "asc" },
            take: 5,
          }),
      empty
        ? Promise.resolve([])
        : prisma.activityLog.findMany({
            where: { projectId: inScope },
            orderBy: { createdAt: "desc" },
            take: 8,
          }),
      hasPermission(session, "report:view_all"),
    ]);

  const actorIds = [...new Set(recent.map((r) => r.actorId).filter(Boolean) as string[])];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } } })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const totals = portfolio?.totals;
  const delta = formatDelta(totals?.throughputDeltaPct ?? null);
  const attention = (portfolio?.projects ?? [])
    .filter((p) => p.health !== "on_track")
    .sort(byHealthThenOverdue);
  const portfolioPreview = (attention.length > 0 ? attention : (portfolio?.projects ?? []))
    .slice(0, PORTFOLIO_PREVIEW);

  const deadlines = [
    ...upcomingDeliverables.map((d) => ({
      id: `d-${d.id}`,
      kind: "Entregavel",
      name: d.name,
      date: d.dueDate!,
      projectKey: d.project.key,
      projectColor: d.project.color,
      href: `/planning?project=${d.projectId}&tab=deliverables`,
    })),
    ...upcomingMilestones.map((m) => ({
      id: `m-${m.id}`,
      kind: "Marco",
      name: m.name,
      date: m.date!,
      projectKey: m.project.key,
      projectColor: m.project.color,
      href: `/planning?project=${m.projectId}&tab=roadmap`,
    })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title={`Ola, ${session.name.split(" ")[0]}`}
        description={`Visao geral do laboratorio nos ultimos ${PERIOD_DAYS} dias.`}
        actions={
          canSeeReports ? (
            <Link
              href="/reports?view=portfolio"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface2 hover:text-fg"
            >
              Portfolio completo
              <ArrowRight size={14} />
            </Link>
          ) : undefined
        }
      />

      <WorkspaceScopeBar
        label={scope.label}
        scopedCount={ids.length}
        visibleCount={scope.visibleCount}
        focused={scope.focused}
      />

      {empty ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Nenhum projeto neste contexto</p>
          <p className="mt-1 text-sm text-muted">
            Ajuste os filtros de contexto na barra superior ou participe de um projeto.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat
              icon={<ListTodo size={18} />}
              label="Tarefas abertas"
              value={totals?.tasksOpen ?? 0}
            />
            <Stat
              icon={<CheckCircle2 size={18} />}
              label={`Concluidas em ${PERIOD_DAYS}d`}
              value={totals?.tasksCompletedInPeriod ?? 0}
              hint={delta.text}
              hintTone={delta.tone}
            />
            <Stat
              icon={<AlertTriangle size={18} />}
              label="Tarefas atrasadas"
              value={totals?.tasksOverdue ?? 0}
              tone={(totals?.tasksOverdue ?? 0) > 0 ? "danger" : "default"}
            />
            <Stat
              icon={<PackageCheck size={18} />}
              label="Entregaveis ativos"
              value={totals?.deliverablesOpen ?? 0}
              hint={
                (totals?.deliverablesOverdue ?? 0) > 0
                  ? `${totals?.deliverablesOverdue} atrasado(s)`
                  : undefined
              }
              hintTone={(totals?.deliverablesOverdue ?? 0) > 0 ? "down" : "flat"}
            />
            <Stat
              icon={<Flag size={18} />}
              label="Projetos em risco"
              value={(totals?.projectsAtRisk ?? 0) + (totals?.projectsCritical ?? 0)}
              hint={`de ${totals?.projects ?? 0} projeto(s)`}
              tone={(totals?.projectsCritical ?? 0) > 0 ? "danger" : "default"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {attention.length > 0 ? "Projetos que pedem atencao" : "Saude do portfolio"}
                  </h2>
                  {canSeeReports && (
                    <Link href="/reports?view=portfolio" className="text-xs text-muted hover:text-fg">
                      ver todos
                    </Link>
                  )}
                </div>
                <div className="space-y-1">
                  {portfolioPreview.length === 0 && (
                    <p className="text-sm text-muted">Sem projetos para exibir.</p>
                  )}
                  {portfolioPreview.map((p) => {
                    const meta = HEALTH_META[p.health];
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface2"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.color }}
                          title={meta.label}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge color={p.color}>{p.key}</Badge>
                            <span className="truncate text-sm font-medium">{p.name}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {p.risks.length > 0 ? p.risks.join(" · ") : `${p.progressPct}% concluido`}
                          </p>
                        </div>
                        <div className="hidden w-28 shrink-0 sm:block">
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.progressPct}%`, backgroundColor: meta.color }}
                            />
                          </div>
                          <p className="mt-1 text-right text-[11px] text-muted">
                            {p.tasks.done}/{p.tasks.total} tarefas
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold">Minhas tarefas</h2>
                <div className="space-y-2">
                  {myTasks.length === 0 && (
                    <p className="text-sm text-muted">Nenhuma tarefa atribuida a voce neste contexto.</p>
                  )}
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
                              d !== null && d < 0
                                ? "text-red-400"
                                : d !== null && d <= 3
                                  ? "text-amber-400"
                                  : "text-muted"
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
            </div>

            <div className="space-y-6">
              <PluginSlot slot="dashboard.widgets" />
              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold">Proximos prazos</h2>
                <div className="space-y-2.5">
                  {deadlines.length === 0 && <p className="text-sm text-muted">Sem prazos proximos.</p>}
                  {deadlines.map((d) => {
                    const left = daysUntil(d.date);
                    return (
                      <Link key={d.id} href={d.href} className="block group">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate group-hover:text-brand">{d.name}</span>
                          <span
                            className={`shrink-0 text-xs ${
                              left !== null && left < 0
                                ? "text-red-400"
                                : left !== null && left <= 3
                                  ? "text-amber-400"
                                  : "text-muted"
                            }`}
                          >
                            {formatDate(d.date)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge color={d.projectColor}>{d.projectKey}</Badge>
                          <span className="text-[11px] text-muted">{d.kind}</span>
                        </div>
                      </Link>
                    );
                  })}
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
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  hintTone = "flat",
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  hintTone?: "up" | "down" | "flat";
  tone?: "default" | "danger";
}) {
  const hintColor =
    hintTone === "up" ? "text-emerald-500" : hintTone === "down" ? "text-amber-500" : "text-muted";
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          tone === "danger" ? "bg-red-500/15 text-red-500" : "bg-brand/15 text-brand"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 truncate text-xs text-muted">{label}</p>
        {hint && (
          <p className={`mt-0.5 flex items-center gap-1 truncate text-[11px] ${hintColor}`}>
            {hintTone === "up" && <TrendingUp size={11} />}
            {hintTone === "down" && <TrendingDown size={11} />}
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
