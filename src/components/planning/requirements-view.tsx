"use client";

import { useMemo, useState } from "react";
import { Select, Card, Badge, EmptyState } from "@/components/ui";
import {
  NewRequirementButton,
  RequirementStatusControl,
  REQ_STATUS,
  REQ_KIND,
} from "@/components/planning/planning-forms";

type Project = { id: string; key: string; name: string; color: string };
type Activity = { id: string; name: string; code: string | null; projectId: string };
type Requirement = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  priority: string;
  projectId: string;
  project: Project;
  activities: { id: string; name: string; code: string | null }[];
  deliverables: { id: string; name: string }[];
};

function RequirementTable({
  rows,
  showProject,
  canWrite,
}: {
  rows: Requirement[];
  showProject: boolean;
  canWrite: Record<string, boolean>;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">Nenhum requisito neste projeto.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface2/50 text-left text-xs text-muted">
            {showProject && <th className="px-4 py-2 font-medium">Projeto</th>}
            <th className="px-4 py-2 font-medium">Codigo</th>
            <th className="px-4 py-2 font-medium">Requisito</th>
            <th className="px-4 py-2 font-medium">Tipo</th>
            <th className="px-4 py-2 font-medium">Atividades</th>
            <th className="px-4 py-2 font-medium">Entregaveis</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 align-top">
              {showProject && (
                <td className="px-4 py-3">
                  <Badge color={r.project.color}>{r.project.key}</Badge>
                  <p className="mt-1 max-w-[120px] text-xs text-muted leading-snug">{r.project.name}</p>
                </td>
              )}
              <td className="px-4 py-3 font-mono text-xs text-muted">{r.code ?? "—"}</td>
              <td className="px-4 py-3">
                <p className="font-medium">{r.title}</p>
                {r.description && <p className="mt-0.5 text-xs text-muted">{r.description}</p>}
              </td>
              <td className="px-4 py-3">
                <Badge className="bg-surface2 text-muted">{REQ_KIND[r.kind] ?? r.kind}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  {r.activities.length === 0 && (
                    <span className="text-xs text-amber-400">Sem atividade</span>
                  )}
                  {r.activities.map((a) => (
                    <span key={a.id} className="text-xs">
                      {a.code ? `${a.code} ` : ""}{a.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  {r.deliverables.length === 0 && (
                    <span className="text-xs text-amber-400">Sem entregavel</span>
                  )}
                  {r.deliverables.map((d) => (
                    <span key={d.id} className="text-xs">{d.name}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: REQ_STATUS[r.status]?.color }}
                  />
                  <RequirementStatusControl
                    id={r.id}
                    status={r.status}
                    disabled={!canWrite[r.projectId]}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RequirementsView({
  projects,
  requirements,
  activities,
  canWrite,
}: {
  projects: Project[];
  requirements: Requirement[];
  activities: Activity[];
  canWrite: Record<string, boolean>;
}) {
  const [projectId, setProjectId] = useState("");

  const filtered = useMemo(
    () => (projectId ? requirements.filter((r) => r.projectId === projectId) : requirements),
    [requirements, projectId],
  );

  const grouped = useMemo(() => {
    if (projectId) return null;
    const map = new Map<string, Requirement[]>();
    for (const p of projects) map.set(p.id, []);
    for (const r of requirements) map.get(r.projectId)?.push(r);
    return projects
      .map((p) => ({ project: p, rows: map.get(p.id) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [projectId, projects, requirements]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const writableProjects = projects.filter((p) => canWrite[p.id]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="min-w-[200px]"
          >
            <option value="">Todos os projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
            ))}
          </Select>
          <span className="text-sm text-muted">
            {filtered.length} requisito{filtered.length !== 1 ? "s" : ""}
            {selectedProject ? ` em ${selectedProject.key}` : ` em ${projects.length} projeto(s)`}
          </span>
        </div>
        {writableProjects.length > 0 && (
          <NewRequirementButton
            projects={writableProjects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
            activities={activities}
            defaultProjectId={projectId || undefined}
          />
        )}
      </div>

      {requirements.length === 0 ? (
        <EmptyState title="Nenhum requisito" description="Defina metas e requisitos para os projetos." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum requisito neste projeto"
          description="Selecione outro projeto ou crie um novo requisito."
          action={
            writableProjects.length > 0 ? (
              <NewRequirementButton
                projects={writableProjects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
                activities={activities}
                defaultProjectId={projectId}
              />
            ) : undefined
          }
        />
      ) : projectId ? (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-surface2/30 px-4 py-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedProject?.color }} />
            <span className="font-medium">{selectedProject?.name}</span>
            <Badge color={selectedProject?.color}>{selectedProject?.key}</Badge>
          </div>
          <RequirementTable rows={filtered} showProject={false} canWrite={canWrite} />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped?.map(({ project, rows }) => (
            <Card key={project.id} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-surface2/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                  <span className="font-medium">{project.name}</span>
                  <Badge color={project.color}>{project.key}</Badge>
                </div>
                <span className="text-xs text-muted">{rows.length} requisito(s)</span>
              </div>
              <RequirementTable rows={rows} showProject={false} canWrite={canWrite} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
