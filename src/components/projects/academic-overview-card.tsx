"use client";

import Link from "next/link";
import { Card, Badge, Button, LinkButton } from "@/components/ui";
import type { ProjectAcademicMeta } from "@/lib/projects/academic-meta";
import type { ProjectPaperMeta } from "@/lib/projects/paper-meta";
import { PAPER_STATUS_LABELS, PAPER_STATUS_COLORS } from "@/lib/projects/paper-meta";
import { PROJECT_KIND_LABELS, type ProjectKind } from "@/lib/projects/features";
import { GraduationCap, Newspaper, ListTodo, BookOpen } from "lucide-react";

function fieldPreview(text: string, max = 140) {
  const t = text.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function AcademicOverviewCard({
  projectId,
  kind,
  academic,
  paper,
  taskCount,
  onOpenMethodology,
  onOpenPaper,
}: {
  projectId: string;
  kind: ProjectKind;
  academic: ProjectAcademicMeta;
  paper: ProjectPaperMeta;
  taskCount: number;
  onOpenMethodology?: () => void;
  onOpenPaper?: () => void;
}) {
  const isPaper = kind === "paper";
  const objective = isPaper
    ? fieldPreview(paper.objective || paper.abstract)
    : fieldPreview(academic.objective || academic.problemStatement);
  const problem = isPaper
    ? fieldPreview(paper.problemStatement)
    : fieldPreview(academic.problemStatement);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {isPaper ? <Newspaper size={18} className="text-brand" /> : <GraduationCap size={18} className="text-brand" />}
        <h2 className="text-sm font-semibold">{PROJECT_KIND_LABELS[kind]}</h2>
        {isPaper && (
          <Badge color={PAPER_STATUS_COLORS[paper.status]}>{PAPER_STATUS_LABELS[paper.status]}</Badge>
        )}
      </div>

      {objective && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Objetivo</p>
          <p className="mt-0.5 text-sm">{objective}</p>
        </div>
      )}
      {problem && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Problema</p>
          <p className="mt-0.5 text-sm">{problem}</p>
        </div>
      )}

      {!isPaper && (academic.advisorName || academic.expectedDefenseDate) && (
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          {academic.advisorName && <span>Orientador: {academic.advisorName}</span>}
          {academic.expectedDefenseDate && (
            <span>Defesa: {academic.expectedDefenseDate.slice(0, 10)}</span>
          )}
          {academic.courses.length > 0 && <span>{academic.courses.length} disciplinas</span>}
          {academic.pending.length > 0 && <span>{academic.pending.length} pendencias</span>}
        </div>
      )}

      {isPaper && (paper.venue || paper.doi) && (
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          {paper.venue && <span>Venue: {paper.venue}</span>}
          {paper.doi && <span>DOI: {paper.doi}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {!isPaper && onOpenMethodology && (
          <Button size="sm" variant="outline" onClick={onOpenMethodology}>
            Metodologia
          </Button>
        )}
        {isPaper && onOpenPaper && (
          <Button size="sm" variant="outline" onClick={onOpenPaper}>
            Pipeline / metodologia
          </Button>
        )}
        <LinkButton href={`/board?project=${projectId}`}>
          <ListTodo size={14} /> {taskCount} tarefas
        </LinkButton>
        <Link
          href={`/projects/${projectId}?tab=files`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-surface2"
        >
          <BookOpen size={14} /> Arquivos
        </Link>
        <Link href={`/projects/${projectId}?tab=tasks`} className="text-xs text-brand hover:underline self-center">
          Ver tarefas do projeto
        </Link>
      </div>
    </Card>
  );
}
