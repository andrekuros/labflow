"use client";

import Link from "next/link";
import { BookOpen, FileIcon, FolderOpen } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { KnowledgeLinksPanel } from "@/components/knowledge/knowledge-links";
import type { ProjectFileRow } from "@/lib/knowledge/project-file-types";

const TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  deliverable: "Entregavel",
  requirement: "Requisito",
  project: "Projeto",
  verification: "V&V",
};

export function ProjectFilesPanel({
  projectId,
  writable,
  files,
  libraryFolder,
}: {
  projectId: string;
  writable: boolean;
  files: ProjectFileRow[];
  libraryFolder: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Arquivos do projeto</h2>
            <p className="text-xs text-muted">
              Paginas e arquivos do vault vinculados a este projeto, tarefas, entregaveis, requisitos ou V&amp;V.
            </p>
          </div>
          <Link
            href={`/knowledge?folder=${encodeURIComponent(libraryFolder)}`}
            className="text-xs text-brand hover:underline"
          >
            Abrir na biblioteca
          </Link>
        </div>
        <KnowledgeLinksPanel
          targetType="project"
          targetId={projectId}
          projectId={projectId}
          canEdit={writable}
          compact
        />
      </Card>

      {files.length === 0 ? (
        <EmptyState
          title="Nenhum arquivo"
          description="Envie um arquivo acima ou vincule artigos da biblioteca."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Titulo</th>
                <th className="px-4 py-2 font-medium">Pasta</th>
                <th className="px-4 py-2 font-medium">Vinculado a</th>
                <th className="px-4 py-2 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const Icon = f.kind === "file" ? FileIcon : BookOpen;
                return (
                  <tr key={f.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/knowledge/${f.id}`} className="flex items-center gap-1.5 hover:text-brand">
                        <Icon size={14} className="shrink-0 text-muted" />
                        <span className="truncate">{f.title}</span>
                        {f.kind === "file" && f.fileName && (
                          <Badge className="bg-surface2 text-[10px] text-muted">
                            {f.fileName.split(".").pop()?.toUpperCase()}
                          </Badge>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen size={12} />
                        {f.externalFolder || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {f.links.length === 0 ? (
                        <span className="text-muted">Projeto</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {f.links.map((l) => (
                            <Badge key={`${l.targetType}-${l.targetId}`} className="bg-surface2 text-muted">
                              {TYPE_LABEL[l.targetType] ?? l.targetType}: {l.label}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatDate(f.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
