"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  BookOpen,
  RefreshCw,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, Button, Label, Textarea, Badge } from "@/components/ui";
import type { ProjectReportConfig, ProjectReportData, ProjectReportSections } from "@/lib/projects/project-document-types";
import { defaultReportConfig, normalizeReportConfig } from "@/lib/projects/project-document-types";
import {
  loadProjectReportDataAction,
  previewProjectDocumentAction,
  generateProjectDocumentPdfAction,
  publishProjectDocumentToKnowledgeAction,
} from "@/plugins/projects/report-actions";

const SECTION_LABELS: Record<keyof ProjectReportSections, string> = {
  overview: "Visao geral",
  conops: "CONOPS",
  team: "Equipe",
  wbs: "WBS com tarefas alinhadas",
  deliverables: "Entregaveis",
  requirements: "Requisitos",
  milestones: "Marcos",
  tasks: "Plano consolidado de tarefas",
  sprints: "Sprints",
};

function downloadText(filename: string, content: string, mime = "text/markdown;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64(filename: string, base64: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ItemPicker({
  title,
  items,
  selected,
  onChange,
  label,
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label: (item: { id: string; label: string }) => string;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0;

  function toggle(id: string) {
    if (allSelected) {
      onChange(items.filter((i) => i.id !== id).map((i) => i.id));
      return;
    }
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = [...set];
    onChange(next.length === items.length ? [] : next);
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface2"
      >
        <span className="font-medium">{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {allSelected ? `Todos (${items.length})` : `${selected.length} selecionado(s)`}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && (
        <div className="max-h-48 space-y-1 overflow-y-auto border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => onChange([])}
            className="mb-1 text-xs text-brand hover:underline"
          >
            Selecionar todos
          </button>
          {items.map((item) => {
            const on = allSelected || selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-start gap-2 rounded px-1 py-1 text-left text-xs hover:bg-surface2"
              >
                {on ? <CheckSquare size={14} className="mt-0.5 shrink-0 text-brand" /> : <Square size={14} className="mt-0.5 shrink-0 text-muted" />}
                <span>{label(item)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProjectReportPanel({
  projectId,
  projectKey,
  writable,
}: {
  projectId: string;
  projectKey: string;
  writable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [data, setData] = useState<ProjectReportData | null>(null);
  const [config, setConfig] = useState<ProjectReportConfig>(defaultReportConfig());
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    start(async () => {
      setError("");
      try {
        const loaded = await loadProjectReportDataAction(projectId);
        setData(loaded);
        const md = await previewProjectDocumentAction(projectId, defaultReportConfig());
        setPreview(md);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      }
    });
  }, [projectId]);

  const wbsItems = useMemo(
    () =>
      (data?.workPackages ?? []).map((w) => ({
        id: w.id,
        label: `${w.code ? `${w.code} ` : ""}${w.name}`,
      })),
    [data],
  );

  function setSection<K extends keyof ProjectReportSections>(key: K, value: boolean) {
    setConfig((c) =>
      normalizeReportConfig({
        ...c,
        sections: { ...c.sections, [key]: value },
      }),
    );
  }

  function refreshPreview() {
    start(async () => {
      setError("");
      setInfo("");
      try {
        const md = await previewProjectDocumentAction(projectId, config);
        setPreview(md);
        setInfo("Preview atualizado.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao gerar preview");
      }
    });
  }

  function downloadMd() {
    const filename = `labflow-${projectKey.toLowerCase()}-documentacao.md`;
    downloadText(filename, preview);
  }

  function downloadPdf() {
    start(async () => {
      setError("");
      try {
        const { base64, filename } = await generateProjectDocumentPdfAction(projectId, config);
        downloadBase64(filename, base64, "application/pdf");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao gerar PDF");
      }
    });
  }

  function publishToKnowledge() {
    start(async () => {
      setError("");
      setInfo("");
      try {
        const r = await publishProjectDocumentToKnowledgeAction(projectId, config, preview);
        setInfo(r.created ? "Artigo criado na base de conhecimento." : "Artigo atualizado na base de conhecimento.");
        setData((d) =>
          d ? { ...d, knowledgeArticleId: r.articleId, knowledgeArticleTitle: r.title } : d,
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao publicar");
      }
    });
  }

  if (!data) {
    return <p className="text-sm text-muted">Carregando dados do relatorio...</p>;
  }

  const sections = config.sections ?? defaultReportConfig().sections;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Documentacao completa do projeto</h2>
        <p className="mb-4 text-xs text-muted">
          Gere um relatorio profissional em Markdown e PDF com CONOPS, WBS, entregaveis e tarefas alinhadas.
          Publique na base de conhecimento para o assistente de IA utilizar como referencia.
        </p>

        {data.knowledgeArticleId && (
          <p className="mb-3 text-xs">
            Artigo na base:{" "}
            <Link href={`/knowledge/${data.knowledgeArticleId}`} className="text-brand hover:underline">
              {data.knowledgeArticleTitle}
            </Link>
          </p>
        )}

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        {info && <p className="mb-3 text-sm text-brand">{info}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Secoes do documento</Label>
              <div className="space-y-2">
                {(Object.keys(SECTION_LABELS) as (keyof ProjectReportSections)[]).map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sections[key]}
                      onChange={(e) => setSection(key, e.target.checked)}
                      className="rounded border-border"
                    />
                    {SECTION_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="block">Opcoes</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.includeTaskDescriptions}
                  onChange={(e) =>
                    setConfig((c) => normalizeReportConfig({ ...c, includeTaskDescriptions: e.target.checked }))
                  }
                  className="rounded border-border"
                />
                Incluir descricoes das tarefas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.includeCompletedTasks}
                  onChange={(e) =>
                    setConfig((c) => normalizeReportConfig({ ...c, includeCompletedTasks: e.target.checked }))
                  }
                  className="rounded border-border"
                />
                Incluir tarefas concluidas
              </label>
            </div>

            <div className="space-y-2">
              <Label className="block">Itens especificos (vazio = todos)</Label>
              <ItemPicker
                title="Pacotes WBS"
                items={wbsItems}
                selected={config.wbsIds}
                onChange={(ids) => setConfig((c) => normalizeReportConfig({ ...c, wbsIds: ids }))}
                label={(i) => i.label}
              />
              <ItemPicker
                title="Entregaveis"
                items={data.deliverables.map((d) => ({ id: d.id, label: d.name }))}
                selected={config.deliverableIds}
                onChange={(ids) => setConfig((c) => normalizeReportConfig({ ...c, deliverableIds: ids }))}
                label={(i) => i.label}
              />
              <ItemPicker
                title="Requisitos"
                items={data.requirements.map((r) => ({
                  id: r.id,
                  label: `${r.code ? `${r.code} ` : ""}${r.title}`,
                }))}
                selected={config.requirementIds}
                onChange={(ids) => setConfig((c) => normalizeReportConfig({ ...c, requirementIds: ids }))}
                label={(i) => i.label}
              />
              <ItemPicker
                title="Marcos"
                items={data.milestones.map((m) => ({ id: m.id, label: m.name }))}
                selected={config.milestoneIds}
                onChange={(ids) => setConfig((c) => normalizeReportConfig({ ...c, milestoneIds: ids }))}
                label={(i) => i.label}
              />
              <ItemPicker
                title="Tarefas"
                items={data.tasks.map((t) => ({ id: t.id, label: t.title }))}
                selected={config.taskIds}
                onChange={(ids) => setConfig((c) => normalizeReportConfig({ ...c, taskIds: ids }))}
                label={(i) => i.label}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={refreshPreview}>
                <RefreshCw size={14} /> Atualizar preview
              </Button>
              <Button size="sm" variant="outline" disabled={pending || !preview} onClick={downloadMd}>
                <Download size={14} /> Baixar MD
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={downloadPdf}>
                <FileText size={14} /> Baixar PDF
              </Button>
              {writable && (
                <Button size="sm" disabled={pending || !preview} onClick={publishToKnowledge}>
                  <BookOpen size={14} /> Publicar na base de conhecimento
                </Button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Preview Markdown</Label>
              <Badge className="bg-surface2 text-muted">{preview.split("\n").length} linhas</Badge>
            </div>
            <Textarea
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              rows={28}
              className="font-mono text-xs leading-relaxed"
              readOnly={!writable}
            />
            {writable && (
              <p className="mt-2 text-xs text-muted">
                Voce pode editar o Markdown antes de publicar na base de conhecimento. Downloads usam o preview atual.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
