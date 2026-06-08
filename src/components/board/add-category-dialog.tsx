"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Select, Label } from "@/components/ui";
import { createLabel } from "@/app/actions/projects";
import type { ProjectItem } from "@/components/board/types";

const COLORS = ["#64748b", "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#0ea5e9"];

export function AddCategoryDialog({
  projects,
  defaultProjectId,
  canWrite,
  onCreated,
  trigger,
}: {
  projects: ProjectItem[];
  defaultProjectId?: string;
  canWrite: Record<string, boolean>;
  onCreated?: (label: { id: string; name: string; color: string; projectId: string }) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const writable = projects.filter((p) => canWrite[p.id]);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId && canWrite[defaultProjectId] ? defaultProjectId : writable[0]?.id ?? "");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[1]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (writable.length === 0) return null;

  function close() {
    setOpen(false);
    setName("");
    setError("");
  }

  function submit() {
    if (!name.trim() || !projectId) return;
    start(async () => {
      setError("");
      try {
        const label = await createLabel({ projectId, name: name.trim(), color });
        onCreated?.({ id: label.id, name: label.name, color: label.color, projectId: label.projectId });
        close();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao criar categoria");
      }
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Nova categoria
        </Button>
      )}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Nova categoria</h2>
              <button onClick={close} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Projeto</Label>
                <Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full"
                  disabled={!!defaultProjectId && canWrite[defaultProjectId]}
                >
                  {writable.map((p) => (
                    <option key={p.id} value={p.id}>{p.key} - {p.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Experimento, Escrita..." autoFocus />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-fg scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={close}>Cancelar</Button>
                <Button disabled={pending || !name.trim()} onClick={submit}>
                  {pending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
