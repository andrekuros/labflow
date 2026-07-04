"use client";

import { useState, useTransition } from "react";
import { Card, Badge, Button, PageHeader } from "@/components/ui";
import {
  submitFeedback,
  updateFeedbackStatus,
  assignFeedback,
  linkFeedbackProject,
  addFeedbackComment,
  generateDraftsFromFeedback,
  acceptFeedbackDraft,
  rejectFeedbackDraft,
  type FeedbackCategory,
} from "@/plugins/feedback/actions";

type CommentRow = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
};

type DraftRow = {
  id: string;
  artifactType: string;
  title: string;
  payload: string;
  status: string;
};

type ProjectOption = { id: string; key: string; name: string };

type FeedbackRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  platformUrl: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  projectId: string | null;
  project: ProjectOption | null;
  createdAt: string;
  submittedBy: { id: string; name: string; email: string };
  comments: CommentRow[];
  linkedDrafts: string;
};

type UserOption = { id: string; name: string };

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  suggestion: "Sugestao",
  question: "Duvida",
  equipment: "Equipamento/Material",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};
const STATUS_COLORS: Record<string, string> = {
  open: "#f59e0b",
  triaged: "#3b82f6",
  in_progress: "#8b5cf6",
  resolved: "#22c55e",
  closed: "#64748b",
};
const ALL_STATUSES = ["open", "triaged", "in_progress", "resolved", "closed"];
const ARTIFACT_LABELS: Record<string, string> = { task: "Tarefa", requirement: "Requisito" };

export function FeedbackPage({
  feedbacks: initial,
  initialDrafts,
  canManage,
  currentUserId,
  users,
  projects,
}: {
  feedbacks: FeedbackRow[];
  initialDrafts: Record<string, DraftRow[]>;
  canManage: boolean;
  currentUserId: string;
  users: UserOption[];
  projects: ProjectOption[];
}) {
  const [feedbacks, setFeedbacks] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [draftsMap, setDraftsMap] = useState<Record<string, DraftRow[]>>(initialDrafts);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  function updateLocal(id: string, patch: Partial<FeedbackRow>) {
    setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  return (
    <div>
      <PageHeader
        title="Feedback"
        description="Reporte erros, sugira melhorias, solicite equipamentos ou tire duvidas."
      />

      <div className="mb-4">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Novo feedback"}
        </Button>
      </div>

      {showForm && (
        <FeedbackForm
          disabled={pending}
          projects={projects}
          onSubmit={(data) =>
            start(async () => {
              const res = await submitFeedback(data);
              if ("id" in res) {
                setShowForm(false);
                window.location.reload();
              }
            })
          }
        />
      )}

      <div className="space-y-3">
        {feedbacks.length === 0 && <p className="text-sm text-muted">Nenhum feedback registrado.</p>}
        {feedbacks.map((fb) => {
          const isExpanded = expanded === fb.id;
          const canComment = canManage || fb.submittedBy.id === currentUserId;
          const fbDrafts = draftsMap[fb.id] ?? [];

          return (
            <Card key={fb.id} className="p-4">
              <div
                className="flex cursor-pointer flex-wrap items-start justify-between gap-2"
                onClick={() => setExpanded(isExpanded ? null : fb.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{fb.title}</h3>
                    <Badge className="bg-surface2 text-muted">{CATEGORY_LABELS[fb.category] ?? fb.category}</Badge>
                    <Badge color={STATUS_COLORS[fb.status]}>{STATUS_LABELS[fb.status] ?? fb.status}</Badge>
                    {fb.project && <Badge className="bg-surface2 text-muted">{fb.project.key}</Badge>}
                  </div>
                  {fb.description && <p className="mt-1 text-sm text-muted">{fb.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {fb.submittedBy.name} · {new Date(fb.createdAt).toLocaleDateString("pt-BR")}
                    {fb.assignee && <> · Responsavel: {fb.assignee.name}</>}
                    {fb.platformUrl && <> · <span className="font-mono">{fb.platformUrl}</span></>}
                    {fb.comments.length > 0 && <> · {fb.comments.length} comentario(s)</>}
                  </p>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-3 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                  {canManage && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Status</label>
                        <select
                          className="h-8 rounded-lg border border-border bg-surface2 px-2 text-xs"
                          value={fb.status}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            start(async () => {
                              await updateFeedbackStatus(fb.id, newStatus);
                              updateLocal(fb.id, { status: newStatus });
                            });
                          }}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Responsavel</label>
                        <select
                          className="h-8 rounded-lg border border-border bg-surface2 px-2 text-xs"
                          value={fb.assigneeId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            start(async () => {
                              await assignFeedback(fb.id, val);
                              const assignee = val ? users.find((u) => u.id === val) : null;
                              updateLocal(fb.id, {
                                assigneeId: val,
                                assignee: assignee ? { ...assignee, email: "" } : null,
                                status: val && fb.status === "open" ? "in_progress" : fb.status,
                              });
                            });
                          }}
                        >
                          <option value="">Nenhum</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Projeto</label>
                        <select
                          className="h-8 rounded-lg border border-border bg-surface2 px-2 text-xs"
                          value={fb.projectId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            start(async () => {
                              await linkFeedbackProject(fb.id, val);
                              const proj = val ? projects.find((p) => p.id === val) : null;
                              updateLocal(fb.id, { projectId: val, project: proj ?? null });
                            });
                          }}
                        >
                          <option value="">Nenhum</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="space-y-2">
                    {fb.comments.map((c) => (
                      <div key={c.id} className="rounded-lg bg-surface2 p-2 text-sm">
                        <p className="text-xs font-medium text-muted">
                          {c.author.name} · {new Date(c.createdAt).toLocaleString("pt-BR")}
                        </p>
                        <p className="mt-0.5">{c.content}</p>
                      </div>
                    ))}
                  </div>

                  {canComment && (
                    <CommentInput
                      disabled={pending}
                      onSubmit={(content) =>
                        start(async () => {
                          const res = await addFeedbackComment(fb.id, content);
                          if (res && "id" in res) {
                            updateLocal(fb.id, {
                              comments: [...fb.comments, { ...res, createdAt: new Date().toISOString() }],
                            });
                          }
                        })
                      }
                    />
                  )}

                  {/* AI Drafts */}
                  <div className="border-t border-border pt-3">
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-medium text-muted">Sugestoes da IA</p>
                      <AiGenerateButton
                        feedbackId={fb.id}
                        projectId={fb.projectId}
                        projects={projects}
                        loading={aiLoading === fb.id}
                        disabled={pending || aiLoading !== null}
                        onGenerate={(targetProjectId) => {
                          setAiLoading(fb.id);
                          start(async () => {
                            const res = await generateDraftsFromFeedback(fb.id, targetProjectId);
                            setAiLoading(null);
                            if ("drafts" in res && res.drafts) {
                              setDraftsMap((prev) => ({
                                ...prev,
                                [fb.id]: [...(prev[fb.id] ?? []), ...res.drafts!],
                              }));
                            }
                          });
                        }}
                      />
                    </div>

                    {fbDrafts.length > 0 && (
                      <div className="space-y-2">
                        {fbDrafts.map((d) => (
                          <div key={d.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <Badge className="bg-surface2 text-muted text-[10px]">
                                  {ARTIFACT_LABELS[d.artifactType] ?? d.artifactType}
                                </Badge>
                                <span className="font-medium">{d.title}</span>
                              </div>
                            </div>
                            {d.status === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() =>
                                    start(async () => {
                                      await acceptFeedbackDraft(d.id);
                                      setDraftsMap((prev) => ({
                                        ...prev,
                                        [fb.id]: (prev[fb.id] ?? []).map((x) =>
                                          x.id === d.id ? { ...x, status: "accepted" } : x,
                                        ),
                                      }));
                                    })
                                  }
                                >
                                  Aceitar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() =>
                                    start(async () => {
                                      await rejectFeedbackDraft(d.id);
                                      setDraftsMap((prev) => ({
                                        ...prev,
                                        [fb.id]: (prev[fb.id] ?? []).map((x) =>
                                          x.id === d.id ? { ...x, status: "rejected" } : x,
                                        ),
                                      }));
                                    })
                                  }
                                >
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                            {d.status !== "pending" && (
                              <Badge color={d.status === "accepted" ? "#22c55e" : "#64748b"}>
                                {d.status === "accepted" ? "Aceito" : "Rejeitado"}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AiGenerateButton({
  feedbackId,
  projectId,
  projects,
  loading,
  disabled,
  onGenerate,
}: {
  feedbackId: string;
  projectId: string | null;
  projects: ProjectOption[];
  loading: boolean;
  disabled: boolean;
  onGenerate: (projectId: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState(projectId ?? "");

  if (loading) return <span className="text-xs text-muted">Gerando...</span>;

  if (projectId) {
    return (
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onGenerate(projectId)}>
        Gerar Tarefa/Requisito por IA
      </Button>
    );
  }

  if (!showPicker) {
    return (
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setShowPicker(true)}>
        Gerar Tarefa/Requisito por IA
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="h-7 rounded-lg border border-border bg-surface2 px-2 text-xs"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Selecione projeto...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
        ))}
      </select>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !selected}
        onClick={() => { onGenerate(selected); setShowPicker(false); }}
      >
        Gerar
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowPicker(false)}>Cancelar</Button>
    </div>
  );
}

function CommentInput({ disabled, onSubmit }: { disabled: boolean; onSubmit: (c: string) => void }) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(text);
        setText("");
      }}
    >
      <input
        type="text"
        className="h-8 flex-1 rounded-lg border border-border bg-surface2 px-3 text-sm"
        placeholder="Adicionar comentario..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={disabled || !text.trim()}>Enviar</Button>
    </form>
  );
}

function FeedbackForm({
  disabled,
  projects,
  onSubmit,
}: {
  disabled: boolean;
  projects: ProjectOption[];
  onSubmit: (data: { title: string; description: string; category: FeedbackCategory; platformUrl?: string; projectId?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [url, setUrl] = useState("");
  const [projectId, setProjectId] = useState("");

  return (
    <Card className="mb-6 p-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title, description, category, platformUrl: url || undefined, projectId: projectId || undefined });
        }}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="fb-title">Titulo *</label>
          <input
            id="fb-title"
            type="text"
            required
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted" htmlFor="fb-cat">Categoria</label>
            <select
              id="fb-cat"
              className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            >
              <option value="bug">Bug / Erro</option>
              <option value="suggestion">Sugestao de melhoria</option>
              <option value="question">Duvida</option>
              <option value="equipment">Equipamento / Material</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted" htmlFor="fb-proj">Projeto (opcional)</label>
            <select
              id="fb-proj"
              className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="fb-desc">Descricao</label>
          <textarea
            id="fb-desc"
            rows={4}
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="fb-url">URL da pagina (opcional)</label>
          <input
            id="fb-url"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder="/projects/BIO"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <Button type="submit" size="sm" disabled={disabled || !title.trim()}>Enviar feedback</Button>
      </form>
    </Card>
  );
}
