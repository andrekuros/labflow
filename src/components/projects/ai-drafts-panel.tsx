"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Pencil,
  Bot,
  Upload,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import { Button, Card, Badge, Textarea } from "@/components/ui";
import {
  acceptDraft,
  acceptDraftsBulk,
  rejectDraft,
  rejectDraftsBulk,
  updateDraftPayload,
} from "@/plugins/projects/conops-actions";
import { parseDraftPayload, TYPE_META } from "@/components/projects/draft-preview";

const TYPE_LABELS: Record<string, string> = {
  requirement: "Requisito",
  task: "Tarefa",
  deliverable: "Entregavel",
  work_package: "WBS",
  milestone: "Marco",
  system_element: "Elemento",
  verification_case: "V&V",
  sprint_plan: "Plano de sprint",
};

export type DraftRow = {
  id: string;
  artifactType: string;
  title: string;
  payload: string;
  source: string;
  createdAt?: string;
};

function formatWhen(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function DraftPreviewBody({ preview }: { preview: ReturnType<typeof parseDraftPayload> }) {
  const [expanded, setExpanded] = useState(false);
  const summary = preview.summary;
  const long = summary && summary.length > 280;

  return (
    <div className="space-y-3">
      {summary && (
        <div>
          <p
            className={`text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap ${!expanded && long ? "line-clamp-4" : ""}`}
          >
            {summary}
          </p>
          {long && (
            <button
              type="button"
              className="mt-1 text-xs text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Ver menos" : "Ver descricao completa"}
            </button>
          )}
        </div>
      )}

      {preview.fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {preview.fields
            .filter((f) => f.tone !== "block")
            .map((f) =>
              f.tone === "badge" ? (
                <span
                  key={`${f.label}-${f.value}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2 px-2 py-0.5 text-xs"
                >
                  <span className="text-muted">{f.label}:</span>
                  <span style={f.color ? { color: f.color } : undefined} className="font-medium">
                    {f.value}
                  </span>
                </span>
              ) : (
                <span key={`${f.label}-${f.value}`} className="text-xs text-muted">
                  <span className="font-medium text-foreground/80">{f.label}:</span> {f.value}
                </span>
              ),
            )}
        </div>
      )}

      {preview.fields
        .filter((f) => f.tone === "block")
        .map((f) => (
          <div key={`${f.label}-${f.value}`} className="rounded-lg border border-border/80 bg-surface2/60 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{f.label}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{f.value}</p>
          </div>
        ))}
    </div>
  );
}

function DraftCard({
  draft,
  projectId,
  writable,
  pending,
  onError,
  onRefresh,
}: {
  draft: DraftRow;
  projectId: string;
  writable: boolean;
  pending: boolean;
  onError: (msg: string) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editPayload, setEditPayload] = useState(draft.payload);
  const [showJson, setShowJson] = useState(false);
  const [, startTransition] = useTransition();

  const meta = TYPE_META[draft.artifactType] ?? { label: draft.artifactType, color: "#94a3b8" };
  const preview = parseDraftPayload(draft.artifactType, draft.payload, draft.title);
  const when = formatWhen(draft.createdAt);

  let formattedJson = draft.payload;
  try {
    formattedJson = JSON.stringify(JSON.parse(draft.payload), null, 2);
  } catch {
    /* keep raw */
  }

  return (
    <article
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}
    >
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="text-[10px]" color={meta.color}>
                {TYPE_LABELS[draft.artifactType] ?? meta.label}
              </Badge>
              {draft.source === "import" ? (
                <Badge className="bg-surface2 text-muted text-[10px]">
                  <Upload size={10} className="mr-1 inline" />
                  Importado
                </Badge>
              ) : (
                <Badge className="bg-orange-500/15 text-orange-600 text-[10px]">
                  <Sparkles size={10} className="mr-1 inline" />
                  IA
                </Badge>
              )}
              {when && <span className="text-[10px] text-muted">{when}</span>}
            </div>
            <h3 className="text-base font-semibold leading-snug">{preview.headline}</h3>
          </div>

          {writable && !editing && (
            <div className="flex shrink-0 flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                title="Editar JSON"
                onClick={() => {
                  setEditing(true);
                  setEditPayload(draft.payload);
                  onError("");
                }}
              >
                <Pencil size={12} />
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    onError("");
                    try {
                      await acceptDraft(draft.id, projectId);
                      onRefresh();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : "Erro ao aceitar");
                    }
                  })
                }
              >
                <Check size={12} /> Aceitar
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                title="Rejeitar"
                onClick={() =>
                  startTransition(async () => {
                    await rejectDraft(draft.id, projectId);
                    onRefresh();
                  })
                }
              >
                <X size={12} />
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-xs text-muted">Edite o JSON do artefato. O titulo e campos serao atualizados ao salvar.</p>
            <Textarea value={editPayload} onChange={(e) => setEditPayload(e.target.value)} rows={8} className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    onError("");
                    try {
                      await updateDraftPayload(draft.id, projectId, editPayload);
                      setEditing(false);
                      onRefresh();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : "JSON invalido");
                    }
                  })
                }
              >
                Salvar edicao
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 border-t border-border/60 pt-3">
            <DraftPreviewBody preview={preview} />
            <button
              type="button"
              className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-foreground"
              onClick={() => setShowJson((v) => !v)}
            >
              {showJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showJson ? "Ocultar JSON" : "Ver JSON tecnico"}
            </button>
            {showJson && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface2 p-3 font-mono text-[11px] text-muted">
                {formattedJson}
              </pre>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function AiDraftsPanel({
  projectId,
  drafts,
  writable,
  showEmpty = false,
}: {
  projectId: string;
  drafts: DraftRow[];
  writable: boolean;
  showEmpty?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of drafts) map[d.artifactType] = (map[d.artifactType] ?? 0) + 1;
    return map;
  }, [drafts]);

  const visible = useMemo(
    () => (filter ? drafts.filter((d) => d.artifactType === filter) : drafts),
    [drafts, filter],
  );

  if (drafts.length === 0 && !showEmpty) return null;

  if (drafts.length === 0) {
    return (
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <Bot size={16} className="text-orange-500" />
          <h2 className="text-sm font-semibold">Rascunhos para revisao</h2>
        </div>
        <p className="text-sm text-muted">
          Nenhum rascunho pendente. Gere artefatos pelo CONOPS, importe Markdown ou JSON para criar sugestoes da IA.
        </p>
      </Card>
    );
  }

  const refresh = () => router.refresh();

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-orange-500" />
          <h2 className="text-sm font-semibold">Rascunhos para revisao</h2>
          <Badge className="bg-orange-500/15 text-orange-600">{drafts.length}</Badge>
        </div>
        {writable && visible.length > 1 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  try {
                    await acceptDraftsBulk(
                      visible.map((d) => d.id),
                      projectId,
                    );
                    refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Erro ao aceitar em lote");
                  }
                })
              }
            >
              <CheckCheck size={12} /> Aceitar {filter ? "filtradas" : "todas"} ({visible.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await rejectDraftsBulk(
                    visible.map((d) => d.id),
                    projectId,
                  );
                  refresh();
                })
              }
            >
              Rejeitar ({visible.length})
            </Button>
          </div>
        )}
      </div>

      <p className="mb-4 text-xs text-muted">
        Revise o conteudo antes de aceitar. Cada item sera criado no projeto conforme o tipo (tarefa, requisito, etc.).
      </p>

      {Object.keys(counts).length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface2"
            }`}
          >
            Todos ({drafts.length})
          </button>
          {Object.entries(counts)
            .sort(([a], [b]) => (TYPE_META[a]?.label ?? a).localeCompare(TYPE_META[b]?.label ?? b))
            .map(([type, count]) => {
              const meta = TYPE_META[type];
              const active = filter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(active ? null : type)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface2"
                  }`}
                  style={active && meta ? { borderColor: meta.color, color: meta.color, backgroundColor: `${meta.color}18` } : undefined}
                >
                  {TYPE_LABELS[type] ?? meta?.label ?? type} ({count})
                </button>
              );
            })}
        </div>
      )}

      {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="space-y-3">
        {visible.map((d) => (
          <DraftCard
            key={d.id}
            draft={d}
            projectId={projectId}
            writable={writable}
            pending={pending}
            onError={setError}
            onRefresh={refresh}
          />
        ))}
      </div>

      {filter && visible.length === 0 && (
        <p className="text-sm text-muted">Nenhum rascunho neste filtro.</p>
      )}
    </Card>
  );
}
