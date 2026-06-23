"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label } from "@/components/ui";
import { createRequirement, setRequirementStatus } from "@/plugins/requirements/actions";
import { createMilestone, setMilestoneStatus } from "@/plugins/roadmap/actions";

export const REQ_STATUS: Record<string, { label: string; color: string }> = {
  proposed: { label: "Proposto", color: "#64748b" },
  approved: { label: "Aprovado", color: "#3b82f6" },
  implemented: { label: "Implementado", color: "#a855f7" },
  verified: { label: "Verificado", color: "#22c55e" },
};

export const REQ_KIND: Record<string, string> = {
  goal: "Meta", functional: "Funcional", nonfunctional: "Nao-funcional", constraint: "Restricao",
};

export const MS_KIND: Record<string, { label: string; color: string }> = {
  milestone: { label: "Marco", color: "#6366f1" },
  verification: { label: "Verificacao", color: "#f59e0b" },
  validation: { label: "Validacao", color: "#ec4899" },
  release: { label: "Release", color: "#22c55e" },
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function NewRequirementButton({ projects, activities, defaultProjectId }: {
  projects: { id: string; key: string; name: string }[];
  activities: { id: string; name: string; code: string | null; projectId: string }[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(
    defaultProjectId && projects.some((p) => p.id === defaultProjectId)
      ? defaultProjectId
      : projects[0]?.id ?? "",
  );
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("goal");
  const [priority, setPriority] = useState("medium");
  const [actIds, setActIds] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const acts = activities.filter((a) => a.projectId === projectId);
  if (projects.length === 0) return null;

  function openDialog() {
    if (defaultProjectId && projects.some((p) => p.id === defaultProjectId)) {
      setProjectId(defaultProjectId);
    }
    setOpen(true);
  }

  return (
    <>
      <Button onClick={openDialog}><Plus size={16} /> Novo requisito</Button>
      {open && (
        <Modal title="Novo requisito / meta" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div><Label>Projeto</Label>
              <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setActIds([]); }} className="w-full">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.key} - {p.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Codigo</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="REQ-003" /></div>
              <div className="col-span-2"><Label>Titulo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            </div>
            <div><Label>Descricao</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label><Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">{Object.entries(REQ_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
              <div><Label>Prioridade</Label><Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full"><option value="low">Baixa</option><option value="medium">Media</option><option value="high">Alta</option></Select></div>
            </div>
            {acts.length > 0 && (
              <div><Label>Atividades relacionadas</Label>
                <div className="flex flex-wrap gap-2">
                  {acts.map((a) => {
                    const on = actIds.includes(a.id);
                    return <button key={a.id} onClick={() => setActIds(on ? actIds.filter((x) => x !== a.id) : [...actIds, a.id])}
                      className={`rounded-md border px-2 py-1 text-xs transition ${on ? "border-brand bg-brand/15" : "border-border hover:bg-surface2"}`}>{a.code ? a.code + " " : ""}{a.name}</button>;
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={pending || !title} onClick={() => start(async () => {
                await createRequirement({ projectId, title, code, description, kind, priority, activityIds: actIds });
                setOpen(false); setTitle(""); setCode(""); setDescription(""); setActIds([]); router.refresh();
              })}>Criar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function RequirementStatusControl({ id, status, disabled }: { id: string; status: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select value={status} disabled={disabled || pending} onChange={(e) => start(async () => { await setRequirementStatus(id, e.target.value); router.refresh(); })}>
      {Object.entries(REQ_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </Select>
  );
}

export function NewMilestoneButton({ projects }: { projects: { id: string; key: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("milestone");
  const [date, setDate] = useState("");
  const [pending, start] = useTransition();
  if (projects.length === 0) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo marco</Button>
      {open && (
        <Modal title="Novo marco / milestone" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div><Label>Projeto</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.key} - {p.name}</option>)}
              </Select>
            </div>
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Qualificacao, Demo v1, V&V" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label><Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">{Object.entries(MS_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
              <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={pending || !name} onClick={() => start(async () => {
                await createMilestone({ projectId, name, kind, date: date || null }); setOpen(false); setName(""); setDate(""); router.refresh();
              })}>Criar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function MilestoneStatusControl({ id, status, disabled }: { id: string; status: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select value={status} disabled={disabled || pending} onChange={(e) => start(async () => { await setMilestoneStatus(id, e.target.value); router.refresh(); })}>
      <option value="upcoming">A vir</option>
      <option value="reached">Atingido</option>
      <option value="missed">Perdido</option>
    </Select>
  );
}
