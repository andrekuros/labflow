"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Upload, Bot, KanbanSquare, Settings, ListTodo, FileBarChart, GraduationCap, Newspaper } from "lucide-react";
import { Card, Badge, Avatar, PageHeader, LinkButton } from "@/components/ui";
import { AddWorkPackageForm, AddLabelForm, AddMemberForm } from "@/components/projects/project-forms";
import { WbsTreePanel, type WbsNode } from "@/components/projects/wbs-tree-panel";
import { ProjectCockpit } from "@/components/projects/project-cockpit";
import { ConopsPanel } from "@/components/projects/conops-panel";
import { TaskImportPanel } from "@/components/projects/task-import-panel";
import { AiDraftsPanel, type DraftRow } from "@/components/projects/ai-drafts-panel";
import { ArtifactsIo } from "@/components/projects/artifacts-io";
import { ProjectSettingsPanel } from "@/components/projects/project-settings-panel";
import { ProjectReportPanel } from "@/components/projects/project-report-panel";
import { ProjectTasksPanel, type ProjectTaskRow } from "@/components/projects/project-tasks-panel";
import { ProjectAcademicPanel } from "@/components/projects/project-academic-panel";
import { ProjectPaperPanel } from "@/components/projects/project-paper-panel";
import { AcademicOverviewCard } from "@/components/projects/academic-overview-card";
import type { ConopsData } from "@/lib/artifacts/schema";
import { projectMemberRoleLabel } from "@/lib/projects/membership-roles";
import { isAcademicKind } from "@/lib/projects/features";
import type { ArtifactCounts } from "@/lib/artifacts/existing-summary";
import type { ProjectFeatures } from "@/lib/projects/features";
import { PROJECT_KIND_LABELS, type ProjectKind } from "@/lib/projects/features";
import type { ProjectAcademicMeta } from "@/lib/projects/academic-meta";
import type { ProjectPaperMeta } from "@/lib/projects/paper-meta";

const BASE_TABS = [
  { id: "overview", label: "Visao geral", icon: LayoutDashboard, feature: null },
  { id: "methodology", label: "Metodologia", icon: GraduationCap, feature: "methodology" as const },
  { id: "paper", label: "Artigo", icon: Newspaper, feature: "paperPipeline" as const },
  { id: "tasks", label: "Tarefas", icon: ListTodo, feature: "board" as const },
  { id: "conops", label: "CONOPS", icon: FileText, feature: "conops" as const },
  { id: "import", label: "Importar tarefas", icon: Upload, feature: "board" as const },
  { id: "review", label: "Revisao IA", icon: Bot, feature: null },
  { id: "report", label: "Relatorio", icon: FileBarChart, feature: null },
] as const;

const SETTINGS_TAB = { id: "settings", label: "Configuracoes", icon: Settings, feature: null } as const;

type TabId = (typeof BASE_TABS)[number]["id"] | "settings";

export function ProjectDetailClient({
  project,
  writable,
  canManage,
  canAssignLead,
  boardColumns,
  initialTab,
  pendingDraftCount,
  conops,
  formatDocId,
  projectBundleFormatDocId,
  artifactCounts,
  drafts,
  cockpit,
  workPackages,
  tasks,
  members,
  labels,
  sprints,
  memberCandidates,
  features,
  academicMeta,
  paperMeta,
}: {
  project: {
    id: string;
    key: string;
    name: string;
    color: string;
    description: string | null;
    status: string;
    kind: ProjectKind;
    taskCount: number;
    deliverableCount: number;
    requirementCount: number;
  };
  writable: boolean;
  canManage: boolean;
  canAssignLead: boolean;
  boardColumns: string[];
  initialTab: string;
  pendingDraftCount: number;
  conops: ConopsData;
  formatDocId?: string | null;
  projectBundleFormatDocId?: string | null;
  artifactCounts: ArtifactCounts;
  drafts: DraftRow[];
  cockpit: React.ComponentProps<typeof ProjectCockpit>;
  workPackages: WbsNode[];
  tasks: ProjectTaskRow[];
  members: { id: string; userId: string; userName: string; userProfilesLabel: string; userRole: string; avatarColor: string; role: string }[];
  labels: { id: string; name: string; color: string }[];
  sprints: { id: string; name: string; status: string }[];
  memberCandidates: { id: string; name: string }[];
  features: ProjectFeatures;
  academicMeta: ProjectAcademicMeta;
  paperMeta: ProjectPaperMeta;
}) {
  const router = useRouter();
  const availableTabs = [
    ...BASE_TABS.filter((t) => !t.feature || features[t.feature]),
    ...(canManage ? [SETTINGS_TAB] : []),
  ];
  const tab = (availableTabs.find((t) => t.id === initialTab)?.id ?? "overview") as TabId;

  function navigate(tabId: TabId) {
    router.push(`/projects/${project.id}?tab=${tabId}`);
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          features.board ? (
            <LinkButton href={`/board?project=${project.id}`}>
              <KanbanSquare size={16} /> Abrir Kanban
            </LinkButton>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge color={project.color}>{project.key}</Badge>
        <Badge className="bg-surface2 text-muted">{PROJECT_KIND_LABELS[project.kind]}</Badge>
        <span className="text-sm text-muted">
          {project.taskCount} tarefas · {project.deliverableCount} entregaveis · {project.requirementCount} requisitos
        </span>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {availableTabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          const showBadge = t.id === "review" && pendingDraftCount > 0;
          return (
            <button
              key={t.id}
              onClick={() => navigate(t.id as TabId)}
              className={`relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-brand text-white" : "text-muted hover:bg-surface2 hover:text-fg"
              }`}
            >
              <Icon size={16} />
              {t.label}
              {showBadge && (
                <span
                  className={`ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    active ? "bg-white text-brand" : "bg-orange-500 text-white"
                  }`}
                >
                  {pendingDraftCount > 99 ? "99+" : pendingDraftCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {isAcademicKind(project.kind) ? (
            <AcademicOverviewCard
              projectId={project.id}
              kind={project.kind}
              academic={academicMeta}
              paper={paperMeta}
              taskCount={project.taskCount}
              onOpenMethodology={() => navigate("methodology")}
              onOpenPaper={() => navigate("paper")}
            />
          ) : (
            <ProjectCockpit {...cockpit} />
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            {features.wbs && (
              <Card className="p-5 lg:col-span-2">
                <h2 className="mb-3 text-sm font-semibold">Estrutura de trabalho (WBS)</h2>
                <p className="mb-3 text-xs text-muted">Atividades hierarquicas no estilo da engenharia de sistemas.</p>
                <div className="mb-4 space-y-0.5">
                  <WbsTreePanel nodes={workPackages} writable={writable} />
                </div>
                {writable && (
                  <AddWorkPackageForm
                    projectId={project.id}
                    parents={workPackages.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
                  />
                )}
              </Card>
            )}
            <div className={`space-y-6 ${features.wbs ? "" : "lg:col-span-3 grid gap-6 lg:grid-cols-3"}`}>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Equipe</h2>
                <div className="mb-3 space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Avatar name={m.userName} color={m.avatarColor} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{m.userName}</p>
                        <p className="text-xs text-muted">{m.userProfilesLabel}</p>
                      </div>
                      <Badge className="bg-surface2 text-muted">{projectMemberRoleLabel(m.role)}</Badge>
                    </div>
                  ))}
                </div>
                {writable && (
                  <AddMemberForm
                    projectId={project.id}
                    candidates={memberCandidates}
                    canAssignLead={canAssignLead}
                    projectKind={project.kind}
                  />
                )}
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Categorias</h2>
                <div className="mb-3 flex flex-wrap gap-2">
                  {labels.length === 0 && <p className="text-sm text-muted">Nenhuma categoria.</p>}
                  {labels.map((l) => (
                    <Badge key={l.id} color={l.color}>
                      {l.name}
                    </Badge>
                  ))}
                </div>
                {writable && <AddLabelForm projectId={project.id} />}
              </Card>
              {features.sprints && (
                <Card className="p-5">
                  <h2 className="mb-3 text-sm font-semibold">Sprints</h2>
                  <div className="space-y-2">
                    {sprints.length === 0 && <p className="text-sm text-muted">Nenhuma sprint.</p>}
                    {sprints.map((s) => (
                      <Link
                        key={s.id}
                        href="/planning?tab=sprints"
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface2"
                      >
                        <span>{s.name}</span>
                        <Badge className="bg-surface2 text-muted">{s.status}</Badge>
                      </Link>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "methodology" && features.methodology && (
        <ProjectAcademicPanel projectId={project.id} writable={writable} initial={academicMeta} />
      )}

      {tab === "paper" && features.paperPipeline && (
        <ProjectPaperPanel projectId={project.id} writable={writable} initial={paperMeta} />
      )}

      {tab === "tasks" && features.board && (
        <ProjectTasksPanel
          projectId={project.id}
          writable={writable}
          tasks={tasks}
          workPackages={workPackages.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        />
      )}

      {tab === "conops" && features.conops && (
        <div className="space-y-6">
          <ConopsPanel
            projectId={project.id}
            initial={conops}
            writable={writable}
            formatDocId={formatDocId}
            artifactCounts={artifactCounts}
          />
          <ArtifactsIo projectId={project.id} writable={writable} />
        </div>
      )}

      {tab === "import" && features.board && (
        <TaskImportPanel projectId={project.id} writable={writable} />
      )}

      {tab === "review" && (
        <div className="space-y-6">
          <AiDraftsPanel projectId={project.id} drafts={drafts} writable={writable} showEmpty />
          <ArtifactsIo projectId={project.id} writable={writable} />
        </div>
      )}

      {tab === "report" && (
        <ProjectReportPanel projectId={project.id} projectKey={project.key} writable={writable} />
      )}

      {tab === "settings" && canManage && (
        <ProjectSettingsPanel
          project={{
            id: project.id,
            key: project.key,
            name: project.name,
            description: project.description,
            color: project.color,
            status: project.status,
            kind: project.kind,
          }}
          members={members.map((m) => ({
            id: m.id,
            userId: m.userId,
            userName: m.userName,
            userProfilesLabel: m.userProfilesLabel,
            avatarColor: m.avatarColor,
            role: m.role,
          }))}
          memberCandidates={memberCandidates}
          boardColumns={boardColumns}
          canAssignLead={canAssignLead}
          features={features}
          projectBundleFormatDocId={projectBundleFormatDocId}
        />
      )}
    </div>
  );
}
