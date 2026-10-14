"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Select } from "@/components/ui";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Diamond,
  Flag,
  Info,
  ListTodo,
  PackageCheck,
  Timer,
  Layers,
  Crosshair,
} from "lucide-react";
import type { GanttData, GanttRow, GanttRowKind } from "@/lib/gantt-types";
import { WorkspaceScopeBar } from "@/components/workspace-scope-bar";

type Zoom = "day" | "week" | "month" | "quarter";

const ZOOMS: { id: Zoom; label: string; pxPerDay: number }[] = [
  { id: "day", label: "Dia", pxPerDay: 28 },
  { id: "week", label: "Semana", pxPerDay: 9 },
  { id: "month", label: "Mes", pxPerDay: 3.2 },
  { id: "quarter", label: "Trimestre", pxPerDay: 1.2 },
];

const KIND_META: Record<GanttRowKind, { label: string; icon: React.ReactNode }> = {
  project: { label: "Projeto", icon: <Layers size={12} /> },
  work_package: { label: "Pacote de trabalho", icon: <ListTodo size={12} /> },
  sprint: { label: "Sprint", icon: <Timer size={12} /> },
  task: { label: "Tarefa", icon: <ListTodo size={12} /> },
  milestone: { label: "Marco", icon: <Flag size={12} /> },
  deliverable: { label: "Entregavel", icon: <PackageCheck size={12} /> },
};

const DAY = 86400000;
const ROW_H = 30;
const LABEL_W = 320;
const HEADER_H = 44;

function fmtShort(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Header buckets for the current zoom: weeks when fine, months when coarse. */
function buildTicks(start: Date, end: Date, zoom: Zoom) {
  const ticks: { key: string; label: string; days: number; strong: boolean }[] = [];
  const cursor = new Date(start);

  if (zoom === "day" || zoom === "week") {
    while (cursor < end) {
      const next = new Date(cursor);
      next.setUTCDate(next.getUTCDate() + 7);
      const days = Math.round((Math.min(next.getTime(), end.getTime()) - cursor.getTime()) / DAY);
      if (days > 0) {
        ticks.push({
          key: cursor.toISOString(),
          label: fmtShort(cursor),
          days,
          strong: cursor.getUTCDate() <= 7,
        });
      }
      cursor.setTime(next.getTime());
    }
    return ticks;
  }

  cursor.setUTCDate(1);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const from = cursor < start ? start : cursor;
    const days = Math.round((Math.min(next.getTime(), end.getTime()) - from.getTime()) / DAY);
    if (days > 0) {
      ticks.push({
        key: cursor.toISOString(),
        label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        days,
        strong: cursor.getUTCMonth() % 3 === 0,
      });
    }
    cursor.setTime(next.getTime());
  }
  return ticks;
}

export function GanttClient({
  data,
  scope,
}: {
  data: GanttData;
  scope: { label: string; focused: boolean; scopedCount: number; visibleCount: number };
}) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [projectFilter, setProjectFilter] = useState("all");
  const [showDone, setShowDone] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pxPerDay = ZOOMS.find((z) => z.id === zoom)!.pxPerDay;
  const rangeStart = useMemo(() => new Date(data.range.start), [data.range.start]);
  const rangeEnd = useMemo(() => new Date(data.range.end), [data.range.end]);
  const totalDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY));
  const chartW = Math.round(totalDays * pxPerDay);
  const ticks = useMemo(() => buildTicks(rangeStart, rangeEnd, zoom), [rangeStart, rangeEnd, zoom]);

  const visible = useMemo(() => {
    // A row is hidden while any ancestor is collapsed; the depth stack tracks that
    // in one pass over the already-flattened, parents-first row list.
    const hiddenUnder: { id: string; depth: number }[] = [];
    const out: GanttRow[] = [];
    for (const row of data.rows) {
      while (hiddenUnder.length > 0 && row.depth <= hiddenUnder[hiddenUnder.length - 1].depth) {
        hiddenUnder.pop();
      }
      if (hiddenUnder.length === 0) {
        const isGroup = row.kind === "project" || row.kind === "work_package";
        const passes =
          (projectFilter === "all" || row.projectId === projectFilter) &&
          (showDone || isGroup || row.progressPct < 100) &&
          (!onlyOverdue || isGroup || row.overdue);
        if (passes) out.push(row);
      }
      if (collapsed.has(row.id)) hiddenUnder.push({ id: row.id, depth: row.depth });
    }
    return out;
  }, [data.rows, collapsed, projectFilter, showDone, onlyOverdue]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function offsetOf(isoDate: string) {
    return ((new Date(isoDate).getTime() - rangeStart.getTime()) / DAY) * pxPerDay;
  }

  const todayX = offsetOf(data.today);

  function scrollToToday() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, todayX - el.clientWidth / 3), behavior: "smooth" });
  }

  return (
    <div>
      <PageHeader
        title="Gantt"
        description="Cronograma consolidado: projetos, pacotes de trabalho, sprints, marcos e entregaveis."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={scrollToToday}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface2 hover:text-fg"
            >
              <Crosshair size={13} /> Hoje
            </button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {ZOOMS.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoom(z.id)}
                  className={`rounded px-2 py-1 text-xs font-medium transition ${
                    zoom === z.id ? "bg-brand text-white" : "text-muted hover:bg-surface2 hover:text-fg"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <WorkspaceScopeBar
        label={scope.label}
        scopedCount={scope.scopedCount}
        visibleCount={scope.visibleCount}
        focused={scope.focused}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="all">Todos os projetos ({data.projects.length})</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Concluidos
        </label>
        <label className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          So atrasados
        </label>
        <button
          type="button"
          onClick={() =>
            collapsed.size > 0
              ? setCollapsed(new Set())
              : setCollapsed(new Set(data.rows.filter((r) => r.childCount > 0).map((r) => r.id)))
          }
          className="rounded border border-border px-2 py-1.5 text-muted transition hover:bg-surface2 hover:text-fg"
        >
          {collapsed.size > 0 ? "Expandir tudo" : "Recolher tudo"}
        </button>
        <span className="ml-auto text-muted">
          {visible.length} linha(s) · {data.counts.placed} item(ns) datado(s)
        </span>
      </div>

      {data.counts.unplaced > 0 && (
        <div className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="font-medium text-amber-600 dark:text-amber-400">
              {data.counts.unplaced} item(ns) sem data nao aparecem no cronograma
            </p>
            <p className="mt-0.5 text-muted">
              {data.unplaced
                .map((u) => {
                  const parts = [
                    u.tasks ? `${u.tasks} tarefa(s)` : null,
                    u.deliverables ? `${u.deliverables} entregavel(is)` : null,
                    u.milestones ? `${u.milestones} marco(s)` : null,
                  ].filter(Boolean);
                  return `${u.projectKey}: ${parts.join(", ")}`;
                })
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Nada para exibir no cronograma</p>
          <p className="mt-1 text-sm text-muted">
            Defina datas de inicio/prazo nas tarefas, sprints, marcos ou entregaveis.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex">
            <div className="shrink-0 border-r border-border" style={{ width: LABEL_W }}>
              <div
                className="flex items-end border-b border-border bg-surface2/60 px-3 pb-1 text-[11px] font-medium text-muted"
                style={{ height: HEADER_H }}
              >
                Estrutura
              </div>
              {visible.map((row) => {
                const meta = KIND_META[row.kind];
                const isGroup = row.kind === "project" || row.kind === "work_package";
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-1 border-b border-border/40 pr-2 text-xs"
                    style={{ height: ROW_H, paddingLeft: 8 + row.depth * 13 }}
                  >
                    {row.childCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        className="shrink-0 rounded p-0.5 text-muted hover:bg-surface2 hover:text-fg"
                        aria-label={collapsed.has(row.id) ? "Expandir" : "Recolher"}
                      >
                        {collapsed.has(row.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      </button>
                    ) : (
                      <span className="w-[18px] shrink-0" />
                    )}
                    <span className="shrink-0 text-muted" title={meta.label}>{meta.icon}</span>
                    {row.code && (
                      <span className="shrink-0 font-mono text-[10px] text-muted">{row.code}</span>
                    )}
                    {row.href ? (
                      <Link
                        href={row.href}
                        className={`truncate hover:text-brand ${isGroup ? "font-medium" : ""}`}
                        title={row.label}
                      >
                        {row.label}
                      </Link>
                    ) : (
                      <span className={`truncate ${isGroup ? "font-medium" : ""}`}>{row.label}</span>
                    )}
                    {row.overdue && (
                      <AlertTriangle size={11} className="ml-auto shrink-0 text-amber-500" />
                    )}
                  </div>
                );
              })}
            </div>

            <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
              <div style={{ width: chartW, minWidth: "100%" }}>
                <div
                  className="sticky top-0 z-10 flex border-b border-border bg-surface2/60"
                  style={{ height: HEADER_H }}
                >
                  {ticks.map((t) => (
                    <div
                      key={t.key}
                      className={`flex shrink-0 items-end overflow-hidden whitespace-nowrap pb-1 pl-1 text-[10px] ${
                        t.strong ? "border-l border-border text-fg" : "border-l border-border/40 text-muted"
                      }`}
                      style={{ width: t.days * pxPerDay }}
                    >
                      {t.days * pxPerDay > 30 ? t.label : ""}
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 flex">
                    {ticks.map((t) => (
                      <div
                        key={t.key}
                        className={`shrink-0 ${
                          t.strong ? "border-l border-border/60" : "border-l border-border/25"
                        }`}
                        style={{ width: t.days * pxPerDay }}
                      />
                    ))}
                  </div>
                  {todayX >= 0 && todayX <= chartW && (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 z-[5] w-px bg-red-500/70"
                      style={{ left: todayX }}
                    />
                  )}

                  {visible.map((row) => (
                    <div
                      key={row.id}
                      className="relative border-b border-border/40"
                      style={{ height: ROW_H }}
                    >
                      {row.start && row.end && (
                        <RowBar row={row} left={offsetOf(row.start)} right={offsetOf(row.end)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface2/30 px-3 py-2 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-6 rounded bg-brand/60" /> barra
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-6 rounded bg-brand/25" /> agregado (datas dos filhos)
            </span>
            <span className="flex items-center gap-1">
              <Diamond size={10} className="fill-purple-500 text-purple-500" /> marco / entregavel
            </span>
            <span className="flex items-center gap-1">
              <span
                className="h-2.5 w-6 rounded border border-border"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(148,163,184,.8) 0 3px, transparent 3px 6px)",
                }}
              />
              inicio inferido do prazo
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-px bg-red-500/70" /> hoje
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

function RowBar({ row, left, right }: { row: GanttRow; left: number; right: number }) {
  const width = Math.max(right - left, 2);
  const tip = [
    KIND_META[row.kind].label,
    row.label,
    `${new Date(row.start!).toLocaleDateString("pt-BR")} → ${new Date(row.end!).toLocaleDateString("pt-BR")}`,
    row.rolledUp ? "datas agregadas dos itens filhos" : null,
    row.inferredStart ? "inicio inferido: a tarefa so tem prazo" : null,
    row.assignees.length ? `responsavel: ${row.assignees.join(", ")}` : null,
    row.overdue ? "ATRASADO" : null,
    `${row.progressPct}% concluido`,
  ]
    .filter(Boolean)
    .join("\n");

  if (row.point) {
    return (
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left }} title={tip}>
        <Diamond
          size={12}
          className={
            row.progressPct === 100
              ? "fill-emerald-500 text-emerald-500"
              : row.overdue
                ? "fill-red-500 text-red-500"
                : row.kind === "deliverable"
                  ? "fill-amber-500 text-amber-500"
                  : "fill-purple-500 text-purple-500"
          }
        />
      </div>
    );
  }

  const isGroup = row.rolledUp;
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded"
      style={{
        left,
        width,
        height: isGroup ? 8 : 14,
        backgroundColor: isGroup ? `${row.color}33` : `${row.color}55`,
        border: row.overdue ? "1px solid rgb(239 68 68 / 0.85)" : `1px solid ${row.color}80`,
        backgroundImage: row.inferredStart
          ? "repeating-linear-gradient(45deg, rgba(148,163,184,.45) 0 3px, transparent 3px 6px)"
          : undefined,
      }}
      title={tip}
    >
      {row.progressPct > 0 && (
        <div
          className="h-full"
          style={{
            width: `${row.progressPct}%`,
            backgroundColor: row.progressPct === 100 ? "#22c55e" : row.color,
            opacity: isGroup ? 0.5 : 0.85,
          }}
        />
      )}
    </div>
  );
}
