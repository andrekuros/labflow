"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, Textarea } from "@/components/ui";
import { AlertTriangle, ChevronRight, Loader2, Plus, Trash2, X, Pencil } from "lucide-react";
import { VISIBILITIES, VISIBILITY_LABELS } from "@/lib/repository/vocab";
import type { RepositoryCollectionNode } from "@/lib/repository/search-types";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "@/plugins/repository/actions";

const COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

function flatten(nodes: RepositoryCollectionNode[]): RepositoryCollectionNode[] {
  const out: RepositoryCollectionNode[] = [];
  function walk(list: RepositoryCollectionNode[]) {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

export function CollectionManager({
  collections,
  onClose,
}: {
  collections: RepositoryCollectionNode[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<RepositoryCollectionNode | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    parentId: "",
    color: COLORS[0],
    visibility: "members",
  });

  const flat = flatten(collections);

  function reset() {
    setEditing(null);
    setForm({ name: "", description: "", parentId: "", color: COLORS[0], visibility: "members" });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome obrigatorio");
      return;
    }
    setError("");
    start(async () => {
      const r = editing
        ? await updateCollection(editing.id, {
            name: form.name,
            description: form.description,
            color: form.color,
            visibility: form.visibility,
            parentId: form.parentId || null,
          })
        : await createCollection({
            name: form.name,
            description: form.description,
            parentId: form.parentId || null,
            color: form.color,
            visibility: form.visibility,
          });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function remove(node: RepositoryCollectionNode) {
    setError("");
    start(async () => {
      const r = await deleteCollection(node.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (editing?.id === node.id) reset();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Colecoes do repositorio</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-surface2">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Estrutura atual
            </p>
            {flat.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma colecao ainda.</p>
            ) : (
              <ul className="space-y-0.5">
                {flat.map((node) => (
                  <li
                    key={node.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-surface2"
                    style={{ paddingLeft: 6 + node.depth * 16 }}
                  >
                    {node.depth > 0 && <ChevronRight size={11} className="shrink-0 text-muted" />}
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: node.color }}
                    />
                    <span className="truncate">{node.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {node.recordCount} deposito(s)
                      {node.visibility !== "members" && ` · ${node.visibility}`}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(node);
                          setForm({
                            name: node.name,
                            description: node.description,
                            parentId: node.parentId ?? "",
                            color: node.color,
                            visibility: node.visibility,
                          });
                        }}
                        className="rounded p-1 text-muted hover:text-brand"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(node)}
                        disabled={pending}
                        className="rounded p-1 text-muted hover:text-red-400 disabled:opacity-40"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {editing ? `Editar: ${editing.name}` : "Nova colecao"}
            </p>
            <div>
              <Label htmlFor="col-name">Nome *</Label>
              <Input
                id="col-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Publicacoes, Teses, Protocolos, Datasets"
              />
            </div>
            <div>
              <Label htmlFor="col-desc">Descricao</Label>
              <Textarea
                id="col-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="col-parent">Colecao pai</Label>
                <Select
                  id="col-parent"
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                >
                  <option value="">Nivel raiz</option>
                  {flat
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${"— ".repeat(c.depth)}${c.name}`}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="col-vis">Visibilidade</Label>
                <Select
                  id="col-vis"
                  value={form.visibility}
                  onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                >
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      form.color === c ? "border-fg" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="flex items-start gap-1 text-xs text-red-400">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {editing ? "Salvar" : "Criar colecao"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface2"
                >
                  Cancelar edicao
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
