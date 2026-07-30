"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, Card, Badge, EmptyState, PageHeader } from "@/components/ui";
import {
  NewRequirementButton,
  RequirementStatusControl,
  REQ_STATUS,
  REQ_KIND,
  NewMilestoneButton,
  MilestoneStatusControl,
  MS_KIND,
} from "@/components/planning/planning-forms";
import {
  NewDeliverableButton,
  DeliverableStatusControl,
  DELIVERABLE_STATUS,
} from "@/components/deliverables/deliverable-forms";
import { SprintStatusControl } from "@/components/sprints/sprint-controls";
import { AddSprintForm } from "@/components/projects/project-forms";
import { SprintAiWizard } from "@/components/sprints/sprint-ai-wizard";
import { KnowledgeLinksPanel } from "@/components/knowledge/knowledge-links";
import { TraceabilityMatrix } from "@/components/planning/traceability-matrix";
import { REQ_LEVEL } from "@/lib/se/constants";
import { SE_GATES } from "@/lib/se/constants";
import { formatDate, daysUntil } from "@/lib/utils";
import { Flag, Timer, ClipboardList, PackageCheck, Map, BarChart3 } from "lucide-react";
import Link from "next/link";

type Project = { id: string; key: string; name: string; color: string };
type Activity = { id: string; name: string; code: string | null; projectId: string };
type Req = {
  id: string; code: string | null; title: string; description: string | null;
  kind: string; level: string; status: string; priority: string;
  projectId: string; parentId?: string | null;
  project: Project;
  activities: { id: string; name: string; code: string | null }[];
  deliverables: { id: string; name: string }[];
  allocatedTo: { id: string; name: string } | null;
  verificationCases: { id: string; name: string; status: string }[];
};
type Deliverable = {
  id: string; name: string; description: string | null; acceptance: string | null;
  status: string; dueDate: string | null; projectId: string;
  project: Project;
  workPackage: { id: string; name: string; code: string | null } | null;
  requirements: { id: string; title: string; code: string | null }[];
};
type Milestone = {
  id: string; name: string; description: string | null; kind: string;
  gate: string | null; status: string; date: string; projectId: string;
  project: { key: string; color: string };
};
type Sprint = {
  id: string; name: string; goal: string | null; status: string;
  startDate: string | null; endDate: string | null; projectId: string;
  project: { key: string; color: string };
  tasksDone: number; tasksTotal: number;
};
type SprintMember = {
  userId: string;
  name: string;
  role: string;
  profilesLabel: string;
  openTaskCount: number;
};
type WorkPackage = { id: string; name: string; code: string | null; projectId: string };

const TABS = [
  { id: "requirements", label: "Requisitos", icon: ClipboardList },
  { id: "deliverables", label: "Entregáveis", icon: PackageCheck },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "sprints", label: "Sprints", icon: Timer },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PlanningPage({
  projects,
  selectedProjectId,
  initialTab,
  canWrite,
  requirements,
  activities,
  systemElements,
  deliverables,
  workPackages,
  allRequirements,
  milestones,
  sprints,
  showSprintsOnRoadmap,
  reqApproved,
  reqTotal,
  sprintMembers,
  sprintCount,
  defaultDurationWeeks,
}: {
  projects: Project[];
  selectedProjectId: string;
  initialTab: string;
  canWrite: boolean;
  requirements: Req[];
  activities: Activity[];
  systemElements: { id: string; name: string; projectId: string }[];
  deliverables: Deliverable[];
  workPackages: WorkPackage[];
  allRequirements: { id: string; title: string; code: string | null; projectId: string; level: string }[];
  milestones: Milestone[];
  sprints: Sprint[];
  showSprintsOnRoadmap: boolean;
  reqApproved: number;
  reqTotal: number;
  sprintMembers: SprintMember[];
  sprintCount: number;
  defaultDurationWeeks: number;
}) {
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === initialTab)?.id ?? "requirements") as TabId;
  const [showMatrix, setShowMatrix] = useState(false);

  function navigate(projectId: string, tabId: string) {
    router.push(`/planning?project=${projectId}&tab=${tabId}`);
  }

  const proj = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  return (
    <div>
      <PageHeader
        title="Planejamento"
        description="Requisitos, entregáveis, roadmap e sprints do projeto."
        actions={
          <Select
            value={selectedProjectId}
            onChange={(e) => navigate(e.target.value, tab)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.key}] {p.name}
              </option>
            ))}
          </Select>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => navigate(selectedProjectId, t.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-surface2 hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "requirements" && (
        <RequirementsTab
          project={proj}
          requirements={requirements}
          activities={activities}
          systemElements={systemElements}
          allRequirements={allRequirements}
          canWrite={canWrite}
          showMatrix={showMatrix}
          onToggleMatrix={() => setShowMatrix((v) => !v)}
        />
      )}
      {tab === "deliverables" && (
        <DeliverablesTab
          project={proj}
          deliverables={deliverables}
          workPackages={workPackages}
          allRequirements={allRequirements}
          canWrite={canWrite}
        />
      )}
      {tab === "roadmap" && (
        <RoadmapTab
          project={proj}
          milestones={milestones}
          sprints={showSprintsOnRoadmap ? sprints : []}
          canWrite={canWrite}
          reqApproved={reqApproved}
          reqTotal={reqTotal}
        />
      )}
      {tab === "sprints" && (
        <SprintsTab
          project={proj}
          sprints={sprints}
          canWrite={canWrite}
          sprintMembers={sprintMembers}
          sprintCount={sprintCount}
          defaultDurationWeeks={defaultDurationWeeks}
        />
      )}
    </div>
  );
}

/* ---------- Requirements ---------- */
function RequirementsTab({
  project,
  requirements,
  activities,
  systemElements,
  allRequirements,
  canWrite,
  showMatrix,
  onToggleMatrix,
}: {
  project: Project;
  requirements: Req[];
  activities: Activity[];
  systemElements: { id: string; name: string; projectId: string }[];
  allRequirements: { id: string; title: string; code: string | null; projectId: string; level: string }[];
  canWrite: boolean;
  showMatrix: boolean;
  onToggleMatrix: () => void;
}) {
  const [levelFilter, setLevelFilter] = useState("");

  const filtered = useMemo(
    () => requirements.filter((r) => !levelFilter || r.level === levelFilter),
    [requirements, levelFilter],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">Todos os niveis</option>
          {Object.entries(REQ_LEVEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <button onClick={onToggleMatrix} className="text-sm text-brand underline">
          {showMatrix ? "Ocultar matriz" : "Matriz de rastreabilidade"}
        </button>
        {canWrite && (
          <NewRequirementButton
            projects={[project]}
            activities={activities}
            systemElements={systemElements}
            requirements={allRequirements}
            defaultProjectId={project.id}
          />
        )}
      </div>

      {showMatrix && <TraceabilityMatrix requirements={filtered} />}

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum requisito" description="Adicione requisitos ao projeto." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const st = REQ_STATUS[r.status];
            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={r.project.color}>{r.project.key}</Badge>
                      {r.code && <span className="text-xs font-mono text-muted">{r.code}</span>}
                      <h3 className="font-medium">{r.title}</h3>
                      {st && <Badge color={st.color}>{st.label}</Badge>}
                      <Badge className="bg-surface2 text-muted text-xs">{REQ_KIND[r.kind] ?? r.kind}</Badge>
                      <Badge className="bg-surface2 text-muted text-xs">{REQ_LEVEL[r.level] ?? r.level}</Badge>
                    </div>
                    {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                      {r.activities.map((a) => <span key={a.id}>WP: {a.code ?? a.name}</span>)}
                      {r.deliverables.map((d) => <Badge key={d.id} className="bg-surface2 text-muted">{d.name}</Badge>)}
                      {r.allocatedTo && <span>→ {r.allocatedTo.name}</span>}
                      {r.verificationCases.length > 0 && (
                        <span>V&V: {r.verificationCases.length} caso(s)</span>
                      )}
                    </div>
                    <KnowledgeLinksPanel
                      targetType="requirement"
                      targetId={r.id}
                      projectId={r.projectId}
                      canEdit={canWrite}
                      compact
                    />
                  </div>
                  <RequirementStatusControl id={r.id} status={r.status} disabled={!canWrite} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Deliverables ---------- */
function DeliverablesTab({
  project,
  deliverables,
  workPackages,
  allRequirements,
  canWrite,
}: {
  project: Project;
  deliverables: Deliverable[];
  workPackages: WorkPackage[];
  allRequirements: { id: string; title: string; code: string | null; projectId: string; level: string }[];
  canWrite: boolean;
}) {
  return (
    <div>
      {canWrite && (
        <div className="mb-4">
          <NewDeliverableButton
            projects={[{ id: project.id, key: project.key, name: project.name }]}
            workPackages={workPackages}
            requirements={allRequirements}
          />
        </div>
      )}

      {deliverables.length === 0 ? (
        <EmptyState title="Nenhum entregável" description="Defina os entregáveis do projeto." />
      ) : (
        <div className="space-y-3">
          {deliverables.map((d) => {
            const days = daysUntil(d.dueDate);
            const st = DELIVERABLE_STATUS[d.status];
            return (
              <Card key={d.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={d.project.color}>{d.project.key}</Badge>
                    <h3 className="font-medium">{d.name}</h3>
                    {st && <Badge color={st.color}>{st.label}</Badge>}
                  </div>
                  {d.description && <p className="mt-1 text-sm text-muted">{d.description}</p>}
                  {d.acceptance && <p className="mt-1 text-xs text-muted"><span className="font-medium">Aceitação:</span> {d.acceptance}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {d.workPackage && <span>WBS: {d.workPackage.code ? d.workPackage.code + " " : ""}{d.workPackage.name}</span>}
                    {d.requirements.map((r) => <Badge key={r.id} className="bg-surface2 text-muted">{r.code ?? r.title}</Badge>)}
                  </div>
                  <KnowledgeLinksPanel
                    targetType="deliverable"
                    targetId={d.id}
                    projectId={d.projectId}
                    canEdit={canWrite}
                    compact
                  />
                </div>
                <div className="flex flex-col items-end gap-2">
                  {d.dueDate && (
                    <span className={`text-xs ${days !== null && days < 0 ? "text-red-400" : days !== null && days <= 7 ? "text-amber-400" : "text-muted"}`}>
                      {formatDate(d.dueDate)}{days !== null && days >= 0 ? ` (${days}d)` : ""}
                    </span>
                  )}
                  <DeliverableStatusControl id={d.id} status={d.status} disabled={!canWrite} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Roadmap ---------- */
function RoadmapTab({
  project,
  milestones,
  sprints,
  canWrite,
  reqApproved,
  reqTotal,
}: {
  project: Project;
  milestones: Milestone[];
  sprints: Sprint[];
  canWrite: boolean;
  reqApproved: number;
  reqTotal: number;
}) {
  type Item = {
    id: string; kind: "milestone" | "sprint"; date: Date; name: string;
    project: { key: string; color: string }; projectId: string;
    subkind?: string; status?: string; gate?: string | null;
  };

  const items: Item[] = useMemo(() => {
    const all: Item[] = [
      ...milestones.map((m) => ({
        id: m.id, kind: "milestone" as const, date: new Date(m.date), name: m.name,
        project: m.project, projectId: m.projectId, subkind: m.kind, status: m.status, gate: m.gate,
      })),
      ...sprints.filter((s) => s.endDate).map((s) => ({
        id: s.id, kind: "sprint" as const, date: new Date(s.endDate!), name: `Fim: ${s.name}`,
        project: s.project, projectId: s.projectId, status: s.status,
      })),
    ];
    return all.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [milestones, sprints]);

  const now = Date.now();

  return (
    <div>
      {canWrite && (
        <div className="mb-4">
          <NewMilestoneButton projects={[{ id: project.id, key: project.key, name: project.name }]} />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="Roadmap vazio" description="Adicione marcos e datas às sprints." />
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
                <Card className={`p-4 ${past && it.status !== "reached" && it.kind === "milestone" ? "border-amber-500/40" : ""}`}>
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
                      {it.gate && reqTotal > 0 && (
                        <p className="mt-1 text-xs text-muted">
                          Prontidão: {reqApproved}/{reqTotal} requisitos aprovados
                        </p>
                      )}
                    </div>
                    {it.kind === "milestone" && (
                      <MilestoneStatusControl id={it.id} status={it.status ?? "upcoming"} disabled={!canWrite} />
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

/* ---------- Sprints ---------- */
function SprintsTab({
  project,
  sprints,
  canWrite,
  sprintMembers,
  sprintCount,
  defaultDurationWeeks,
}: {
  project: Project;
  sprints: Sprint[];
  canWrite: boolean;
  sprintMembers: SprintMember[];
  sprintCount: number;
  defaultDurationWeeks: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {sprints.length === 0 && <EmptyState title="Nenhuma sprint" description="Crie uma sprint para este projeto." />}
        {sprints.map((s) => {
          const pct = s.tasksTotal ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0;
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge color={s.project.color}>{s.project.key}</Badge>
                    <h3 className="font-semibold">{s.name}</h3>
                  </div>
                  {s.goal && <p className="mt-1 text-sm text-muted">{s.goal}</p>}
                  <p className="mt-1 text-xs text-muted">{formatDate(s.startDate)} - {formatDate(s.endDate)}</p>
                </div>
                <SprintStatusControl sprintId={s.id} status={s.status} disabled={!canWrite} />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>{s.tasksDone} de {s.tasksTotal} tarefas</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {canWrite && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Nova sprint</h2>
          <SprintAiWizard
            projectId={project.id}
            projectKey={project.key}
            members={sprintMembers}
            sprintCount={sprintCount}
            defaultDurationWeeks={defaultDurationWeeks}
          />
          <AddSprintForm projectId={project.id} />
        </div>
      )}
    </div>
  );
}
