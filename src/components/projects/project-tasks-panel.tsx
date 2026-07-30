"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ArrowUpDown } from "lucide-react";
import { Card, Badge, Select, Button, Avatar, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { PRIORITIES } from "@/components/board/types";
import { checklistProgress } from "@/lib/task-checklist";
import { updateProjectTaskFields, mapTasksToWbsWithAiAction } from "@/plugins/projects/actions";

export type ProjectTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  dueDate: string | null;
  updatedAt: string;
  workPackageId: string | null;
  workPackageCode: string | null;
  workPackageName: string | null;
  sprintId: string | null;
  sprintName: string | null;
  assignees: { id: string; name: string; avatarColor: string }[];
  labels: { id: string; name: string; color: string }[];
  checklistDone: number;
  checklistTotal: number;
};

type WorkPackageOption = { id: string; code: string | null; name: string };

type SortKey = "title" | "status" | "priority" | "workPackage" | "estimate" | "sprint" | "dueDate" | "updatedAt";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Revisao",
  done: "Concluida",
};

type Props = {
  projectId: string;
  writable: boolean;
  tasks: ProjectTaskRow[];
  workPackages: WorkPackageOption[];
};

export function ProjectTasksPanel({ projectId, writable, tasks, workPackages }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [statusFilter, setStatusFilter] = useState("");
  const [wbsFilter, setWbsFilter] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const unmappedCount = tasks.filter((t) => !t.workPackageId).length;

  const filtered = useMemo(() => {
    let rows = [...tasks];
    if (statusFilter) rows = rows.filter((t) => t.status === statusFilter);
    if (wbsFilter) rows = rows.filter((t) => t.workPackageId === wbsFilter);
    if (unmappedOnly) rows = rows.filter((t) => !t.workPackageId);

    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "title":
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "priority":
          av = a.priority;
          bv = b.priority;
          break;
        case "workPackage":
          av = (a.workPackageCode ?? a.workPackageName ?? "").toLowerCase();
          bv = (b.workPackageCode ?? b.workPackageName ?? "").toLowerCase();
          break;
        case "estimate":
          av = a.estimate ?? 0;
          bv = b.estimate ?? 0;
          break;
        case "sprint":
          av = (a.sprintName ?? "").toLowerCase();
          bv = (b.sprintName ?? "").toLowerCase();
          break;
        case "dueDate":
          av = a.dueDate ?? "";
          bv = b.dueDate ?? "";
          break;
        case "updatedAt":
          av = a.updatedAt;
          bv = b.updatedAt;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [tasks, statusFilter, wbsFilter, unmappedOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function updateField(taskId: string, field: "workPackageId" | "estimate", value: string) {
    start(async () => {
      if (field === "workPackageId") {
        await updateProjectTaskFields({ taskId, workPackageId: value || null });
      } else {
        const num = value.trim() === "" ? null : Number(value);
        await updateProjectTaskFields({ taskId, estimate: num });
      }
      router.refresh();
    });
  }

  function runAiMapper() {
    setAiMsg(null);
    start(async () => {
      const res = await mapTasksToWbsWithAiAction(projectId, { onlyUnmapped: true });
      if (res.error) {
        setAiMsg(res.error);
        return;
      }
      setAiMsg(`${res.created} rascunho(s) criado(s). Revise na aba Revisao IA.`);
      router.push(`/projects/${projectId}?tab=review`);
    });
  }

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={`inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide ${active ? "text-brand" : "text-muted hover:text-fg"}`}
      >
        {label}
        <ArrowUpDown size={12} />
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[140px]">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select value={wbsFilter} onChange={(e) => setWbsFilter(e.target.value)} className="min-w-[180px]">
          <option value="">Todos os WBS</option>
          {workPackages.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code ? `${w.code} — ` : ""}{w.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={unmappedOnly}
            onChange={(e) => setUnmappedOnly(e.target.checked)}
            className="rounded border-border"
          />
          Sem WBS ({unmappedCount})
        </label>
        {writable && unmappedCount > 0 && workPackages.length > 0 && (
          <Button size="sm" variant="outline" onClick={runAiMapper} disabled={pending}>
            <Bot size={14} /> Mapear com IA
          </Button>
        )}
      </div>

      {aiMsg && <p className="text-sm text-muted">{aiMsg}</p>}

      <Card className="overflow-x-auto p-0">
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title="Nenhuma tarefa" description="Ajuste os filtros ou crie tarefas no Kanban." />
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2/50 text-left">
                <th className="px-3 py-2"><SortHeader label="Titulo" col="title" /></th>
                <th className="px-3 py-2"><SortHeader label="Status" col="status" /></th>
                <th className="px-3 py-2"><SortHeader label="Prioridade" col="priority" /></th>
                <th className="px-3 py-2"><SortHeader label="WBS" col="workPackage" /></th>
                <th className="px-3 py-2"><SortHeader label="Estimativa (h)" col="estimate" /></th>
                <th className="px-3 py-2">Responsaveis</th>
                <th className="px-3 py-2">Checklist</th>
                <th className="px-3 py-2"><SortHeader label="Sprint" col="sprint" /></th>
                <th className="px-3 py-2"><SortHeader label="Prazo" col="dueDate" /></th>
                <th className="px-3 py-2"><SortHeader label="Atualizado" col="updatedAt" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/60 hover:bg-surface2/30">
                  <td className="px-3 py-2">
                    <Link href={`/board?project=${projectId}`} className="font-medium hover:text-brand">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className="bg-surface2 text-muted">{STATUS_LABELS[t.status] ?? t.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={PRIORITIES[t.priority]?.color ?? "#64748b"}>
                      {PRIORITIES[t.priority]?.label ?? t.priority}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {writable ? (
                      <Select
                        value={t.workPackageId ?? ""}
                        onChange={(e) => updateField(t.id, "workPackageId", e.target.value)}
                        className="max-w-[180px] text-xs"
                        disabled={pending}
                      >
                        <option value="">—</option>
                        {workPackages.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code ? `${w.code} ` : ""}{w.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-xs text-muted">
                        {t.workPackageCode ? `${t.workPackageCode} ` : ""}{t.workPackageName ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {writable ? (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        defaultValue={t.estimate ?? ""}
                        onBlur={(e) => updateField(t.id, "estimate", e.target.value)}
                        className="w-20 rounded border border-border bg-surface px-2 py-1 text-xs"
                        disabled={pending}
                      />
                    ) : (
                      <span className="text-xs">{t.estimate != null ? `${t.estimate}h` : "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex -space-x-1">
                      {t.assignees.slice(0, 3).map((a) => (
                        <Avatar key={a.id} name={a.name} color={a.avatarColor} />
                      ))}
                      {t.assignees.length === 0 && <span className="text-xs text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {t.checklistTotal > 0 ? `${t.checklistDone}/${t.checklistTotal}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{t.sprintName ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{t.dueDate ? formatDate(t.dueDate) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{formatDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
