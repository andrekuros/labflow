"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Flag,
  ListTodo,
  PackageCheck,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { PortfolioOverview, PortfolioProjectRow, ProjectHealth } from "@/lib/portfolio-types";
import { HEALTH_META, HEALTH_ORDER, byHealthThenOverdue, formatDelta } from "@/lib/portfolio-meta";

type SortKey = "health" | "name" | "progress" | "overdue" | "throughput" | "activity";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "health", label: "Saude (mais urgente)" },
  { key: "overdue", label: "Mais atrasos" },
  { key: "throughput", label: "Mais entregas no periodo" },
  { key: "progress", label: "Menor progresso" },
  { key: "activity", label: "Mais tempo sem atividade" },
  { key: "name", label: "Nome" },
];

function sortRows(rows: PortfolioProjectRow[], key: SortKey): PortfolioProjectRow[] {
  const copy = [...rows];
  switch (key) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "progress":
      return copy.sort((a, b) => a.progressPct - b.progressPct);
    case "overdue":
      return copy.sort((a, b) => b.tasks.overdue - a.tasks.overdue || byHealthThenOverdue(a, b));
    case "throughput":
      return copy.sort((a, b) => b.tasks.completedInPeriod - a.tasks.completedInPeriod);
    case "activity":
      return copy.sort((a, b) => (b.daysSinceActivity ?? 9999) - (a.daysSinceActivity ?? 9999));
    default:
      return copy.sort(byHealthThenOverdue);
  }
}

export function PortfolioDashboard({ data }: { data: PortfolioOverview }) {
  const [health, setHealth] = useState<ProjectHealth | "all">("all");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("health");

  const kinds = useMemo(
    () => [...new Map(data.projects.map((p) => [p.kind, p.kindLabel])).entries()],
    [data.projects],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.projects.filter((p) => {
      if (health !== "all" && p.health !== health) return false;
      if (kind !== "all" && p.kind !== kind) return false;
      if (q && !`${p.key} ${p.name} ${p.leads.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortRows(filtered, sort);
  }, [data.projects, health, kind, query, sort]);

  const t = data.totals;
  const delta = formatDelta(t.throughputDeltaPct);
  const healthCounts = useMemo(() => {
    const counts = new Map<ProjectHealth, number>();
    for (const p of data.projects) counts.set(p.health, (counts.get(p.health) ?? 0) + 1);
    return counts;
  }, [data.projects]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={<ListTodo size={16} />} label="Tarefas abertas" value={t.tasksOpen} />
        <Kpi
          icon={<CheckCircle2 size={16} />}
          label="Concluidas no periodo"
          value={t.tasksCompletedInPeriod}
          hint={delta.text}
          hintTone={delta.tone}
        />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Tarefas atrasadas"
          value={t.tasksOverdue}
          tone={t.tasksOverdue > 0 ? "danger" : "default"}
        />
        <Kpi
          icon={<PackageCheck size={16} />}
          label="Entregaveis ativos"
          value={t.deliverablesOpen}
          hint={t.deliverablesOverdue > 0 ? `${t.deliverablesOverdue} atrasado(s)` : undefined}
          hintTone={t.deliverablesOverdue > 0 ? "down" : "flat"}
        />
        <Kpi
          icon={<Flag size={16} />}
          label="Marcos vencidos"
          value={t.milestonesOverdue}
          tone={t.milestonesOverdue > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">
            Entregas por dia ({formatDate(data.period.from)} a {formatDate(data.period.to)})
          </h3>
          <ThroughputChart series={data.throughput} />
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Saude do portfolio</h3>
          <div className="space-y-2">
            {HEALTH_ORDER.map((h) => {
              const count = healthCounts.get(h) ?? 0;
              const pct = t.projects > 0 ? Math.round((count / t.projects) * 100) : 0;
              const meta = HEALTH_META[h];
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHealth(health === h ? "all" : h)}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition hover:bg-surface2 ${
                    health === h ? "bg-surface2" : ""
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="w-20 shrink-0 text-xs">{meta.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right text-xs font-medium">{count}</span>
                </button>
              );
            })}
          </div>
          {data.byKind.length > 1 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted">Por tipo de projeto</p>
              <div className="space-y-1">
                {data.byKind.map((k) => (
                  <div key={k.kind} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted">{k.kindLabel}</span>
                    <span>
                      {k.projects} proj · {k.tasksOpen} abertas
                      {k.tasksOverdue > 0 && (
                        <span className="text-amber-500"> · {k.tasksOverdue} atrasadas</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Projetos</h3>
          <span className="text-xs text-muted">
            {rows.length} de {data.projects.length}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar projeto ou lider"
                className="h-8 w-44 rounded border border-border bg-surface pl-7 pr-2 text-xs"
              />
            </div>
            <Select
              value={health}
              onChange={(e) => setHealth(e.target.value as ProjectHealth | "all")}
              className="h-8 text-xs"
            >
              <option value="all">Toda saude</option>
              {HEALTH_ORDER.map((h) => (
                <option key={h} value={h}>{HEALTH_META[h].label}</option>
              ))}
            </Select>
            {kinds.length > 1 && (
              <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 text-xs">
                <option value="all">Todo tipo</option>
                {kinds.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </Select>
            )}
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 text-xs"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum projeto neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="pb-2 pr-3">Projeto</th>
                  <th className="pb-2 pr-3">Saude</th>
                  <th className="pb-2 pr-3">Progresso</th>
                  <th className="pb-2 pr-3 text-right">Abertas</th>
                  <th className="pb-2 pr-3 text-right">Atraso</th>
                  <th className="pb-2 pr-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <ArrowUpDown size={11} /> Periodo
                    </span>
                  </th>
                  <th className="pb-2 pr-3">Entregaveis</th>
                  <th className="pb-2 pr-3">Proximo marco</th>
                  <th className="pb-2">Atividade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const meta = HEALTH_META[p.health];
                  const trend = p.tasks.completedInPeriod - p.tasks.completedPrevPeriod;
                  return (
                    <tr key={p.id} className="border-b border-border/50 align-top hover:bg-surface2/40">
                      <td className="py-2.5 pr-3">
                        <Link href={`/projects/${p.id}`} className="group block">
                          <div className="flex items-center gap-2">
                            <Badge color={p.color}>{p.key}</Badge>
                            <span className="font-medium group-hover:text-brand">{p.name}</span>
                          </div>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                            <Users size={10} />
                            {p.leads.length > 0 ? p.leads.join(", ") : "sem lider"}
                            <span className="text-border">·</span>
                            {p.kindLabel}
                          </p>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                        {p.risks.length > 0 && (
                          <p className="mt-1 max-w-[190px] text-[11px] leading-snug text-muted">
                            {p.risks.join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 min-w-[110px]">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${p.progressPct}%`, backgroundColor: meta.color }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {p.progressPct}% · {p.tasks.done}/{p.tasks.total}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{p.tasks.open}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {p.tasks.overdue > 0 ? (
                          <span className="font-medium text-amber-500">{p.tasks.overdue}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="font-medium">{p.tasks.completedInPeriod}</span>
                        {trend !== 0 && (
                          <span
                            className={`ml-1 inline-flex items-center text-[11px] ${
                              trend > 0 ? "text-emerald-500" : "text-amber-500"
                            }`}
                          >
                            {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(trend)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {p.deliverables.total === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            {p.deliverables.accepted}/{p.deliverables.total} aceitos
                            {p.deliverables.overdue > 0 && (
                              <span className="block text-amber-500">
                                {p.deliverables.overdue} atrasado(s)
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {p.milestones.nextDate ? (
                          <>
                            <span className="block truncate max-w-[150px]">{p.milestones.nextName}</span>
                            <span className="text-muted">{formatDate(p.milestones.nextDate)}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {p.milestones.overdue > 0 && (
                          <span className="block text-red-400">{p.milestones.overdue} vencido(s)</span>
                        )}
                      </td>
                      <td className="py-2.5 text-xs">
                        <span className="block">{p.eventsInPeriod} acoes</span>
                        <span
                          className={
                            p.daysSinceActivity !== null && p.daysSinceActivity > 14
                              ? "text-amber-500"
                              : "text-muted"
                          }
                        >
                          {p.lastActivityAt ? formatDate(p.lastActivityAt) : "nunca"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
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
    <Card className="flex items-center gap-3 p-3">
      <div
        className={`shrink-0 rounded-lg p-2 ${
          tone === "danger" ? "bg-red-500/15 text-red-500" : "bg-surface2 text-muted"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="text-xl font-semibold leading-tight">{value}</p>
        {hint && <p className={`truncate text-[11px] ${hintColor}`}>{hint}</p>}
      </div>
    </Card>
  );
}

/** Created vs. completed per day. Bars only — no chart library in this repo. */
function ThroughputChart({ series }: { series: { date: string; completed: number; created: number }[] }) {
  if (series.length === 0) return <p className="text-sm text-muted">Sem dados no periodo.</p>;
  const max = Math.max(...series.flatMap((d) => [d.completed, d.created]), 1);
  const step = series.length > 30 ? Math.ceil(series.length / 12) : series.length > 14 ? 2 : 1;

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
        {series.map((d) => (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col justify-end gap-[2px]"
            title={`${d.date}: ${d.completed} concluida(s), ${d.created} criada(s)`}
          >
            <div
              className="w-full rounded-t-sm bg-emerald-500/80 transition group-hover:bg-emerald-500"
              style={{ height: `${(d.completed / max) * 88}px` }}
            />
            <div
              className="w-full rounded-b-sm bg-brand/35 transition group-hover:bg-brand/55"
              style={{ height: `${(d.created / max) * 28}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {series.map((d, i) => (
          <div key={d.date} className="flex-1 overflow-hidden text-center text-[9px] text-muted">
            {i % step === 0 ? d.date.slice(8, 10) : ""}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> concluidas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-brand/35" /> criadas
        </span>
      </div>
    </div>
  );
}
