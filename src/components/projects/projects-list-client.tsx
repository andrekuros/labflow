"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, PageHeader, EmptyState, Select } from "@/components/ui";
import { NewProjectButton } from "@/components/projects/project-forms";
import { PROJECT_KIND_LABELS, PROJECT_KINDS, type ProjectKind, isProjectKind } from "@/lib/projects/features";

export type ProjectListRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  kind: string;
  status: string;
  taskCount: number;
  deliverableCount: number;
  memberCount: number;
};

const KIND_FILTERS: { id: string; label: string; kinds?: ProjectKind[] }[] = [
  { id: "all", label: "Todos" },
  { id: "lab", label: "Lab", kinds: ["lab"] },
  { id: "admin", label: "Admin", kinds: ["admin"] },
  { id: "academic", label: "Academicos", kinds: ["thesis", "dissertation", "paper"] },
  { id: "thesis", label: "Teses", kinds: ["thesis"] },
  { id: "dissertation", label: "Dissertacoes", kinds: ["dissertation"] },
  { id: "paper", label: "Artigos", kinds: ["paper"] },
];

export function ProjectsListClient({
  projects,
  initialKindFilter = "all",
  myThesisId,
}: {
  projects: ProjectListRow[];
  initialKindFilter?: string;
  myThesisId?: string | null;
}) {
  const [filter, setFilter] = useState(
    KIND_FILTERS.some((f) => f.id === initialKindFilter) ? initialKindFilter : "all",
  );

  const rows = useMemo(() => {
    const def = KIND_FILTERS.find((f) => f.id === filter);
    if (!def?.kinds) return projects;
    const set = new Set(def.kinds);
    return projects.filter((p) => set.has(isProjectKind(p.kind) ? p.kind : "lab"));
  }, [projects, filter]);

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Lab, admin, teses, dissertacoes e artigos — um so lugar de trabalho."
        actions={<NewProjectButton />}
      />

      {myThesisId && (
        <Link
          href={`/projects/${myThesisId}`}
          className="mb-4 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm hover:bg-brand/10"
        >
          <span className="font-medium text-brand">Minha tese / dissertacao</span>
          <span className="text-muted">— abrir trabalho academico</span>
        </Link>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              filter === f.id
                ? "bg-brand text-white"
                : "border border-border text-muted hover:bg-surface2 hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto hidden sm:block">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 text-xs"
          >
            {KIND_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum projeto neste filtro"
          description="Crie um projeto ou ajuste o filtro / contexto de trabalho."
          action={<NewProjectButton />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const kind = isProjectKind(p.kind) ? p.kind : "lab";
            return (
              <Link key={p.id} href={`/projects/${p.id}${kind === "paper" ? "?tab=paper" : ""}`}>
                <Card className="h-full p-5 transition hover:border-brand/60">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <Badge color={p.color}>{p.key}</Badge>
                    <Badge className="bg-surface2 text-muted">{PROJECT_KIND_LABELS[kind]}</Badge>
                    {p.status !== "active" && <Badge className="bg-surface2 text-muted">{p.status}</Badge>}
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span>{p.taskCount} tarefas</span>
                    <span>{p.deliverableCount} entregaveis</span>
                    <span>{p.memberCount} membros</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { PROJECT_KINDS };
