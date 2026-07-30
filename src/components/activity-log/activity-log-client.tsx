"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Select, PageHeader, EmptyState, Avatar } from "@/components/ui";
import { Calendar, ChevronLeft, ChevronRight, Activity, Users, Filter } from "lucide-react";
import type { ActivityLogRow } from "@/lib/activity-log/format";
import { labelForEvent } from "@/lib/activity-log/constants";
import type { DomainEventType } from "@/lib/events";

type UserOption = { id: string; name: string };
type ProjectOption = { id: string; key: string; name: string };
type EventGroup = { label: string; types: DomainEventType[] };
type TypeCount = { type: string; label: string; count: number };

type Props = {
  entries: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
  todayCount: number;
  typeCounts: TypeCount[];
  from: string;
  to: string;
  actorId: string;
  projectId: string;
  eventType: string;
  users: UserOption[];
  projects: ProjectOption[];
  eventGroups: EventGroup[];
};

const PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
];

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityLogClient({
  entries,
  total,
  page,
  pageSize,
  todayCount,
  typeCounts,
  from,
  to,
  actorId,
  projectId,
  eventType,
  users,
  projects,
  eventGroups,
}: Props) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function navigate(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const next = {
      from,
      to,
      actor: actorId || undefined,
      project: projectId || undefined,
      type: eventType || undefined,
      page: String(page),
      ...overrides,
    };
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    if (!overrides.page && (overrides.actor !== undefined || overrides.project !== undefined || overrides.type !== undefined || overrides.from !== undefined || overrides.to !== undefined)) {
      sp.delete("page");
    }
    router.push(`/activity-log?${sp.toString()}`);
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end);
    if (days > 0) start.setDate(start.getDate() - days);
    navigate({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      page: undefined,
    });
  }

  return (
    <div>
      <PageHeader
        title="Registro de atividades"
        description="Timeline global de acoes no laboratorio — visivel apenas para administradores."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Activity size={18} />} label="No periodo" value={total} />
        <Stat icon={<Calendar size={18} />} label="Hoje" value={todayCount} />
        <Stat icon={<Users size={18} />} label="Tipos distintos" value={typeCounts.length} />
        <Stat icon={<Filter size={18} />} label="Pagina" value={`${page}/${totalPages}`} />
      </div>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-muted" />
            <input
              type="date"
              value={from}
              onChange={(e) => navigate({ from: e.target.value, page: undefined })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <span className="text-muted">ate</span>
            <input
              type="date"
              value={to}
              onChange={(e) => navigate({ to: e.target.value, page: undefined })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            />
          </div>

          <Select value={actorId} onChange={(e) => navigate({ actor: e.target.value || undefined, page: undefined })}>
            <option value="">Todos os usuarios</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>

          <Select value={projectId} onChange={(e) => navigate({ project: e.target.value || undefined, page: undefined })}>
            <option value="">Todos os projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
            ))}
          </Select>

          <Select value={eventType} onChange={(e) => navigate({ type: e.target.value || undefined, page: undefined })}>
            <option value="">Todos os eventos</option>
            {eventGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.types.map((t) => (
                  <option key={t} value={t}>{labelForEvent(t)}</option>
                ))}
              </optgroup>
            ))}
          </Select>

          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-surface2 hover:text-fg"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold">Por tipo</h2>
          {typeCounts.length === 0 ? (
            <p className="text-sm text-muted">Nenhum evento no periodo.</p>
          ) : (
            <div className="space-y-2">
              {typeCounts.slice(0, 12).map((tc) => (
                <button
                  key={tc.type}
                  type="button"
                  onClick={() => navigate({ type: tc.type, page: undefined })}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-surface2 ${eventType === tc.type ? "bg-brand/10 text-brand" : ""}`}
                >
                  <span className="truncate pr-2">{tc.label}</span>
                  <span className="shrink-0 font-medium">{tc.count}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold">Timeline</h2>
          {entries.length === 0 ? (
            <EmptyState title="Sem atividades" description="Nenhum evento encontrado com os filtros atuais." />
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface2/30 px-3 py-2.5"
                >
                  {entry.actor ? (
                    <Avatar name={entry.actor.name} color={entry.actor.avatarColor} />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-surface2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{entry.label}</span>
                      {entry.project && (
                        <Badge color={entry.project.color}>{entry.project.key}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {entry.actor?.name ?? "Sistema"}
                      {entry.detail ? ` · ${entry.detail}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatTimestamp(entry.createdAt)}</p>
                  </div>
                  {entry.href && (
                    <Link
                      href={entry.href}
                      className="shrink-0 text-xs text-brand hover:underline"
                    >
                      Ver
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface2 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <span className="text-xs text-muted">
                {total} evento{total !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface2 disabled:opacity-40"
              >
                Proxima
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
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
