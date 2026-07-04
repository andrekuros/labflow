"use client";

import { useState, useTransition } from "react";
import { Card, Badge, Button, PageHeader } from "@/components/ui";
import { submitFeedback, updateFeedbackStatus } from "@/plugins/feedback/actions";

type FeedbackRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  platformUrl: string | null;
  createdAt: string;
  submittedBy: { id: string; name: string; email: string };
};

const CATEGORY_LABELS: Record<string, string> = { bug: "Bug", suggestion: "Sugestao", question: "Duvida" };
const STATUS_LABELS: Record<string, string> = { open: "Aberto", triaged: "Triado", closed: "Fechado" };
const STATUS_COLORS: Record<string, string> = { open: "#f59e0b", triaged: "#3b82f6", closed: "#64748b" };

export function FeedbackPage({
  feedbacks: initial,
  canManage,
}: {
  feedbacks: FeedbackRow[];
  canManage: boolean;
}) {
  const [feedbacks, setFeedbacks] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div>
      <PageHeader
        title="Feedback"
        description="Reporte erros, sugira melhorias ou tire duvidas sobre a plataforma."
      />

      <div className="mb-4">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Novo feedback"}
        </Button>
      </div>

      {showForm && (
        <FeedbackForm
          disabled={pending}
          onSubmit={(data) =>
            start(async () => {
              const res = await submitFeedback(data);
              if ("id" in res) {
                setShowForm(false);
                const refreshed = await (await fetch("/api/v1/feedback/list")).json();
                if (Array.isArray(refreshed)) setFeedbacks(refreshed);
                else window.location.reload();
              }
            })
          }
        />
      )}

      <div className="space-y-3">
        {feedbacks.length === 0 && <p className="text-sm text-muted">Nenhum feedback registrado.</p>}
        {feedbacks.map((fb) => (
          <Card key={fb.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{fb.title}</h3>
                  <Badge className="bg-surface2 text-muted">{CATEGORY_LABELS[fb.category] ?? fb.category}</Badge>
                  <Badge color={STATUS_COLORS[fb.status]}>{STATUS_LABELS[fb.status] ?? fb.status}</Badge>
                </div>
                {fb.description && <p className="mt-1 text-sm text-muted">{fb.description}</p>}
                <p className="mt-1 text-xs text-muted">
                  {fb.submittedBy.name} · {new Date(fb.createdAt).toLocaleDateString("pt-BR")}
                  {fb.platformUrl && (
                    <> · <span className="font-mono">{fb.platformUrl}</span></>
                  )}
                </p>
              </div>
              {canManage && fb.status !== "closed" && (
                <div className="flex gap-1">
                  {fb.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => start(async () => {
                        await updateFeedbackStatus(fb.id, "triaged");
                        setFeedbacks((prev) => prev.map((f) => (f.id === fb.id ? { ...f, status: "triaged" } : f)));
                      })}
                    >
                      Triar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => start(async () => {
                      await updateFeedbackStatus(fb.id, "closed");
                      setFeedbacks((prev) => prev.map((f) => (f.id === fb.id ? { ...f, status: "closed" } : f)));
                    })}
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FeedbackForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (data: { title: string; description: string; category: "bug" | "suggestion" | "question"; platformUrl?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"bug" | "suggestion" | "question">("suggestion");
  const [url, setUrl] = useState("");

  return (
    <Card className="mb-6 p-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title, description, category, platformUrl: url || undefined });
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

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="fb-cat">Categoria</label>
          <select
            id="fb-cat"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="bug">Bug / Erro</option>
            <option value="suggestion">Sugestao de melhoria</option>
            <option value="question">Duvida</option>
          </select>
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
