"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Pencil, Bot, Upload } from "lucide-react";
import { Button, Card, Badge, Textarea } from "@/components/ui";
import { acceptDraft, rejectDraft, updateDraftPayload } from "@/plugins/projects/conops-actions";

const TYPE_LABELS: Record<string, string> = {
  requirement: "Requisito",
  task: "Tarefa",
  deliverable: "Entregavel",
  work_package: "WBS",
  milestone: "Marco",
  system_element: "Elemento",
  verification_case: "V&V",
};

export type DraftRow = {
  id: string;
  artifactType: string;
  title: string;
  payload: string;
  source: string;
};

export function AiDraftsPanel({
  projectId,
  drafts,
  writable,
}: {
  projectId: string;
  drafts: DraftRow[];
  writable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (drafts.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bot size={16} className="text-orange-500" />
        <h2 className="text-sm font-semibold">Rascunhos para revisao</h2>
        <Badge className="bg-orange-500/15 text-orange-600">{drafts.length}</Badge>
      </div>
      <p className="mb-3 text-xs text-muted">
        Artefatos gerados por IA ou importados. Aceite para criar no projeto, edite o JSON ou rejeite.
      </p>

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      <div className="space-y-2">
        {drafts.map((d) => (
          <div key={d.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-orange-500/15 text-orange-600">IA</Badge>
                  <Badge className="bg-surface2 text-muted">{TYPE_LABELS[d.artifactType] ?? d.artifactType}</Badge>
                  {d.source === "import" && <Badge className="bg-surface2 text-muted"><Upload size={10} /> import</Badge>}
                  <span className="text-sm font-medium">{d.title}</span>
                </div>
              </div>
              {writable && editing !== d.id && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setEditing(d.id);
                      setEditPayload(d.payload);
                      setError("");
                    }}
                  >
                    <Pencil size={12} />
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setError("");
                        try {
                          await acceptDraft(d.id, projectId);
                          router.refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Erro ao aceitar");
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
                    onClick={() =>
                      start(async () => {
                        await rejectDraft(d.id, projectId);
                        router.refresh();
                      })
                    }
                  >
                    <X size={12} />
                  </Button>
                </div>
              )}
            </div>

            {editing === d.id ? (
              <div className="mt-2 space-y-2">
                <Textarea value={editPayload} onChange={(e) => setEditPayload(e.target.value)} rows={6} className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setError("");
                        try {
                          await updateDraftPayload(d.id, projectId, editPayload);
                          setEditing(null);
                          router.refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "JSON invalido");
                        }
                      })
                    }
                  >
                    Salvar edicao
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <pre className="mt-2 max-h-24 overflow-auto rounded bg-surface2 p-2 text-xs text-muted">
                {d.payload}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
