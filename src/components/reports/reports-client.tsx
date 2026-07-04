"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Select, PageHeader, EmptyState, Avatar } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  BarChart3,
  ClipboardList,
  CheckCircle2,
  FileText,
  MessageSquare,
  Copy,
  Download,
  Users,
  User as UserIcon,
  Calendar,
  Activity,
} from "lucide-react";
import type { UserActivitySummary, TeamMemberOverview } from "@/plugins/reports/actions";
import { generateReportMarkdown } from "@/plugins/reports/report-markdown";

type UserOption = { id: string; name: string; role: string; title: string | null; avatarColor: string };

type Props = {
  view: "report" | "bi";
  isAdmin: boolean;
  users: UserOption[];
  selectedUserId: string;
  from: string;
  to: string;
  includeAcademic: boolean;
  summary?: UserActivitySummary;
  teamData?: TeamMemberOverview[];
};

const PRESETS = [
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

export function ReportsClient({ view, isAdmin, users, selectedUserId, from, to, includeAcademic, summary, teamData }: Props) {
  const router = useRouter();
  const [copyMsg, setCopyMsg] = useState("");

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({ user: selectedUserId, from, to, view, ...params });
    router.push(`/reports?${sp.toString()}`);
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    navigate({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
  }

  async function copyMarkdown() {
    if (!summary) return;
    const md = generateReportMarkdown(summary);
    await navigator.clipboard.writeText(md);
    setCopyMsg("Copiado!");
    setTimeout(() => setCopyMsg(""), 2000);
  }

  async function downloadMarkdown() {
    if (!summary) return;
    const md = generateReportMarkdown(summary);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${summary.user.name.replace(/\s+/g, "-").toLowerCase()}-${from}-${to}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Relatorios"
        description="Relatorios de atividades e painel de produtividade da equipe."
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate({ view: "report" })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "report" ? "bg-brand text-white" : "text-muted hover:bg-surface2"}`}
              >
                <UserIcon size={14} className="mr-1 inline" />
                Individual
              </button>
              <button
                onClick={() => navigate({ view: "bi" })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "bi" ? "bg-brand text-white" : "text-muted hover:bg-surface2"}`}
              >
                <Users size={14} className="mr-1 inline" />
                Equipe
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {isAdmin && view === "report" && (
          <Select value={selectedUserId} onChange={(e) => navigate({ user: e.target.value })}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        )}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted" />
          <input
            type="date"
            value={from}
            onChange={(e) => navigate({ from: e.target.value })}
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
          />
          <span className="text-muted">a</span>
          <input
            type="date"
            value={to}
            onChange={(e) => navigate({ to: e.target.value })}
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="rounded border border-border px-2 py-1 text-xs text-muted hover:bg-surface2"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {view === "report" && summary && (
        <IndividualReport
          summary={summary}
          includeAcademic={includeAcademic}
          copyMsg={copyMsg}
          onCopy={copyMarkdown}
          onDownload={downloadMarkdown}
        />
      )}

      {view === "bi" && teamData && (
        <TeamDashboard teamData={teamData} from={from} to={to} />
      )}
    </div>
  );
}

/* ---------- Individual Report ---------- */
function IndividualReport({
  summary,
  includeAcademic,
  copyMsg,
  onCopy,
  onDownload,
}: {
  summary: UserActivitySummary;
  includeAcademic: boolean;
  copyMsg: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const k = summary.kpis;

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex gap-2">
        <button onClick={onCopy} className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2">
          <Copy size={14} />
          {copyMsg || "Copiar Markdown"}
        </button>
        <button onClick={onDownload} className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2">
          <Download size={14} />
          Baixar .md
        </button>
      </div>

      {/* User header */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold">{summary.user.name}</h2>
        <p className="text-sm text-muted">
          {summary.user.role}{summary.user.title ? ` · ${summary.user.title}` : ""}
          {" · "}{formatDate(summary.period.from)} a {formatDate(summary.period.to)}
        </p>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<CheckCircle2 size={16} />} label="Tarefas concluidas" value={k.tasksCompleted} />
        <KpiCard icon={<ClipboardList size={16} />} label="Em andamento" value={k.tasksInProgress} />
        <KpiCard icon={<FileText size={16} />} label="Entregaveis" value={k.deliverablesSubmitted} />
        <KpiCard icon={<MessageSquare size={16} />} label="Posts/Topicos" value={k.forumPosts} />
      </div>

      {/* Tasks by project */}
      {summary.tasksByProject.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Tarefas por projeto</h3>
          {summary.tasksByProject.map((proj) => (
            <div key={proj.projectId} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-center gap-2">
                <Badge color={proj.projectColor}>{proj.projectKey}</Badge>
                <span className="text-sm font-medium">{proj.projectName}</span>
                <span className="text-xs text-muted">({proj.tasks.length} tarefas)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-1 pr-3">Tarefa</th>
                      <th className="pb-1 pr-3">Status</th>
                      <th className="pb-1 pr-3">Sprint</th>
                      <th className="pb-1">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proj.tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="py-1.5 pr-3">{t.title}</td>
                        <td className="py-1.5 pr-3">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="py-1.5 pr-3 text-muted">{t.sprintName ?? "-"}</td>
                        <td className="py-1.5 text-muted">{t.dueDate ? formatDate(t.dueDate) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Deliverables */}
      {summary.deliverables.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Entregaveis</h3>
          <div className="space-y-2">
            {summary.deliverables.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge color={d.projectColor}>{d.projectKey}</Badge>
                  <span>{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.dueDate && <span className="text-xs text-muted">{formatDate(d.dueDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Academic */}
      {includeAcademic && summary.academic && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Perfil Academico</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div><span className="text-muted">Programa:</span> {summary.academic.program}</div>
            <div><span className="text-muted">Status:</span> {summary.academic.status}</div>
            <div><span className="text-muted">Orientador:</span> {summary.academic.advisorName ?? "N/I"}</div>
            <div>
              <span className="text-muted">Disciplinas:</span>{" "}
              {summary.academic.coursesDone}/{summary.academic.coursesTotal}
              <ProgressBar value={summary.academic.coursesTotal ? (summary.academic.coursesDone / summary.academic.coursesTotal) * 100 : 0} className="mt-1" />
            </div>
            {summary.academic.objective && (
              <div className="md:col-span-2">
                <span className="text-muted">Objetivo:</span> {summary.academic.objective}
              </div>
            )}
            <div><span className="text-muted">Pendencias:</span> {summary.academic.pendingCount}</div>
          </div>
        </Card>
      )}

      {/* Heatmap */}
      {Object.keys(summary.heatmap).length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Mapa de atividade</h3>
          <ActivityHeatmap heatmap={summary.heatmap} from={summary.period.from} to={summary.period.to} />
        </Card>
      )}

      {/* Timeline */}
      {summary.timeline.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
          <div className="space-y-2">
            {summary.timeline.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 text-sm">
                <Activity size={12} className="shrink-0 text-muted" />
                <span className="shrink-0 text-xs text-muted">{formatDate(ev.createdAt)}</span>
                <span>{ev.label}</span>
                {ev.projectKey && <Badge className="bg-surface2 text-muted text-xs">{ev.projectKey}</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Team Dashboard (BI) ---------- */
function TeamDashboard({ teamData, from, to }: { teamData: TeamMemberOverview[]; from: string; to: string }) {
  const totals = useMemo(() => {
    let completed = 0, total = 0, events = 0, active = 0;
    teamData.forEach((m) => {
      completed += m.tasksCompleted;
      total += m.tasksTotal;
      events += m.totalEvents;
      if (m.totalEvents > 0) active += 1;
    });
    return { completed, total, events, active, members: teamData.length };
  }, [teamData]);

  const maxEvents = Math.max(...teamData.map((m) => m.totalEvents), 1);

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Users size={16} />} label="Membros ativos" value={totals.active} />
        <KpiCard icon={<CheckCircle2 size={16} />} label="Tarefas concluidas" value={totals.completed} />
        <KpiCard icon={<BarChart3 size={16} />} label="Total de acoes" value={totals.events} />
        <KpiCard icon={<ClipboardList size={16} />} label="Tarefas totais" value={totals.total} />
      </div>

      {/* Team table */}
      <Card className="overflow-x-auto p-4">
        <h3 className="mb-3 text-sm font-semibold">Visao da equipe ({formatDate(from)} a {formatDate(to)})</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="pb-2 pr-3">Membro</th>
              <th className="pb-2 pr-3">Papel</th>
              <th className="pb-2 pr-3">Tarefas</th>
              <th className="pb-2 pr-3">Progresso</th>
              <th className="pb-2 pr-3">Acoes</th>
              <th className="pb-2 pr-3">Atividade</th>
              <th className="pb-2">Ultimo evento</th>
            </tr>
          </thead>
          <tbody>
            {teamData.map((m) => {
              const pct = m.tasksTotal ? Math.round((m.tasksCompleted / m.tasksTotal) * 100) : 0;
              const actPct = Math.round((m.totalEvents / maxEvents) * 100);
              return (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} color={m.avatarColor} size="sm" />
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-muted">{m.role}{m.title ? ` · ${m.title}` : ""}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{m.tasksCompleted}</span>
                    <span className="text-muted">/{m.tasksTotal}</span>
                  </td>
                  <td className="py-2 pr-3 min-w-[100px]">
                    <ProgressBar value={pct} />
                  </td>
                  <td className="py-2 pr-3">{m.totalEvents}</td>
                  <td className="py-2 pr-3 min-w-[80px]">
                    <div className="h-2 overflow-hidden rounded-full bg-surface2">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${actPct}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-xs text-muted">
                    {m.lastEventAt ? formatDate(m.lastEventAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------- Shared components ---------- */
function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">{icon}</div>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </Card>
  );
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-muted">{Math.round(value)}%</span>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-500/15 text-green-400",
  accepted: "bg-green-500/15 text-green-400",
  completed: "bg-green-500/15 text-green-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  review: "bg-purple-500/15 text-purple-400",
  submitted: "bg-purple-500/15 text-purple-400",
  todo: "bg-amber-500/15 text-amber-400",
  pending: "bg-amber-500/15 text-amber-400",
  backlog: "bg-gray-500/15 text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-500/15 text-gray-400";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function ActivityHeatmap({ heatmap, from, to }: { heatmap: Record<string, number>; from: string; to: string }) {
  const days = useMemo(() => {
    const result: { date: string; count: number; dayOfWeek: number }[] = [];
    const start = new Date(from);
    const end = new Date(to);
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      result.push({ date: key, count: heatmap[key] ?? 0, dayOfWeek: cur.getDay() });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [heatmap, from, to]);

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  const weeks: (typeof days)[] = [];
  let currentWeek: typeof days = [];
  days.forEach((d, i) => {
    if (i > 0 && d.dayOfWeek === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(d);
  });
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return (
    <div className="flex gap-1 overflow-x-auto">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day) => {
            const intensity = day.count / maxCount;
            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} acoes`}
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: day.count === 0
                    ? "var(--color-surface2, #1e293b)"
                    : `rgba(99, 102, 241, ${0.2 + intensity * 0.8})`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
