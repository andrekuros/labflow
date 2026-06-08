"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label } from "@/components/ui";
import { createDeliverable, setDeliverableStatus } from "@/app/actions/deliverables";

export const DELIVERABLE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "#64748b" },
  in_progress: { label: "Em andamento", color: "#3b82f6" },
  submitted: { label: "Submetido", color: "#a855f7" },
  accepted: { label: "Aceito", color: "#22c55e" },
  rejected: { label: "Rejeitado", color: "#ef4444" },
};

export function NewDeliverableButton({
  projects,
  workPackages,
  requirements,
}: {
  projects: { id: string; key: string; name: string }[];
  workPackages: { id: string; name: string; code: string | null; projectId: string }[];
  requirements: { id: string; title: string; code: string | null; projectId: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [workPackageId, setWorkPackageId] = useState("");
  const [reqIds, setReqIds] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const wps = workPackages.filter((w) => w.projectId === projectId);
  const reqs = requirements.filter((r) => r.projectId === projectId);

  if (projects.length === 0) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo entregavel</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Novo entregavel</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div><Label>Projeto</Label>
                <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setWorkPackageId(""); setReqIds([]); }} className="w-full">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.key} - {p.name}</option>)}
                </Select>
              </div>
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Artigo, dataset, software..." /></div>
              <div><Label>Descricao</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
              <div><Label>Criterios de aceitacao</Label><Textarea value={acceptance} onChange={(e) => setAcceptance(e.target.value)} rows={2} placeholder="Quando este entregavel e considerado pronto?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prazo</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                <div><Label>Atividade (WBS)</Label>
                  <Select value={workPackageId} onChange={(e) => setWorkPackageId(e.target.value)} className="w-full">
                    <option value="">(nenhuma)</option>
                    {wps.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + " " : ""}{w.name}</option>)}
                  </Select>
                </div>
              </div>
              {reqs.length > 0 && (
                <div>
                  <Label>Requisitos atendidos (rastreabilidade)</Label>
                  <div className="flex flex-wrap gap-2">
                    {reqs.map((r) => {
                      const on = reqIds.includes(r.id);
                      return (
                        <button key={r.id} onClick={() => setReqIds(on ? reqIds.filter((x) => x !== r.id) : [...reqIds, r.id])}
                          className={`rounded-md border px-2 py-1 text-xs transition ${on ? "border-brand bg-brand/15" : "border-border hover:bg-surface2"}`}>
                          {r.code ? r.code + " " : ""}{r.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={pending || !name} onClick={() => start(async () => {
                  await createDeliverable({ projectId, name, description, acceptance, dueDate: dueDate || null, workPackageId: workPackageId || null, requirementIds: reqIds });
                  setOpen(false); setName(""); setDescription(""); setAcceptance(""); setReqIds([]); router.refresh();
                })}>Criar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export function DeliverableStatusControl({ id, status, disabled }: { id: string; status: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select value={status} disabled={disabled || pending}
      onChange={(e) => start(async () => { await setDeliverableStatus(id, e.target.value); router.refresh(); })}>
      {Object.entries(DELIVERABLE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </Select>
  );
}
