import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds } from "@/lib/workspace";
import { writableMap } from "@/lib/projects";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { NewMilestoneButton, MilestoneStatusControl, MS_KIND } from "@/components/planning/planning-forms";
import { Flag, Timer } from "lucide-react";
import { SE_GATES } from "@/lib/se/constants";

export default async function RoadmapPage() {
  const session = await requireUser();
  await ensurePluginRegistry();
  const ids = await workspaceProjectIds(session);
  if (ids.length === 0) return <EmptyState title="Nenhum projeto" description="Participe de um projeto para visualizar o roadmap." />;

  const settings = getPluginSettings("roadmap");
  const showSprints = settings.showSprints !== false;

  const [projects, milestones, sprints, canWrite, reqStats] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.milestone.findMany({ where: { projectId: { in: ids } }, include: { project: true } }),
    showSprints
      ? prisma.sprint.findMany({ where: { projectId: { in: ids }, endDate: { not: null } }, include: { project: true } })
      : Promise.resolve([]),
    writableMap(session, ids),
    prisma.requirement.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids } }, _count: true }),
  ]);

  type Item = {
    id: string; kind: "milestone" | "sprint"; date: Date; name: string;
    project: { key: string; color: string }; projectId: string; subkind?: string; status?: string; gate?: string | null;
  };

  function gateReadiness(projectId: string) {
    const approved = reqStats.filter((r) => r.projectId === projectId && r.status === "approved").reduce((s, r) => s + r._count, 0);
    const total = reqStats.filter((r) => r.projectId === projectId).reduce((s, r) => s + r._count, 0);
    return { approved, total };
  }

  const items: Item[] = [
    ...milestones.filter((m) => m.date).map((m) => ({
      id: m.id, kind: "milestone" as const, date: m.date as Date, name: m.name,
      project: { key: m.project.key, color: m.project.color }, projectId: m.projectId, subkind: m.kind, status: m.status, gate: m.gate,
    })),
    ...sprints.map((s) => ({
      id: s.id, kind: "sprint" as const, date: s.endDate as Date, name: `Fim: ${s.name}`,
      project: { key: s.project.key, color: s.project.color }, projectId: s.projectId, status: s.status,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description="Linha do tempo de marcos, verificacoes/validacoes (V&V) e sprints."
        actions={<NewMilestoneButton projects={projects.filter((p) => canWrite[p.id]).map((p) => ({ id: p.id, key: p.key, name: p.name }))} />}
      />

      {items.length === 0 ? (
        <EmptyState title="Roadmap vazio" description="Adicione marcos e datas as sprints para montar a linha do tempo." />
      ) : (
        <div className="relative ml-3 border-l border-border pl-8">
          {items.map((it) => {
            const past = it.date.getTime() < now;
            const ms = it.subkind ? MS_KIND[it.subkind] : null;
            const color = it.kind === "milestone" ? ms?.color ?? "#6366f1" : "#0ea5e9";
            return (
              <div key={`${it.kind}-${it.id}`} className="relative mb-5">
                <span
                  className="absolute -left-[42px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg"
                  style={{ backgroundColor: color }}
                >
                  {it.kind === "milestone" ? <Flag size={12} className="text-white" /> : <Timer size={12} className="text-white" />}
                </span>
                <Card className={`p-4 ${past && it.status !== "reached" && it.kind === "milestone" && settings.highlightOverdue !== false ? "border-amber-500/40" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge color={it.project.color}>{it.project.key}</Badge>
                        {it.gate && SE_GATES[it.gate] && <Badge color={SE_GATES[it.gate].color}>{it.gate}</Badge>}
                        {ms && <Badge color={ms.color}>{ms.label}</Badge>}
                        {it.kind === "sprint" && <Badge color="#0ea5e9">Sprint</Badge>}
                      </div>
                      <p className="mt-1 font-medium">{it.name}</p>
                      <p className="text-xs text-muted">{formatDate(it.date)}</p>
                      {it.gate && (() => { const g = gateReadiness(it.projectId); return g.total > 0 ? <p className="mt-1 text-xs text-muted">Prontidao: {g.approved}/{g.total} requisitos aprovados</p> : null; })()}
                    </div>
                    {it.kind === "milestone" && (
                      <MilestoneStatusControl id={it.id} status={it.status ?? "upcoming"} disabled={!canWrite[it.projectId]} />
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
