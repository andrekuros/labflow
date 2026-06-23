"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label } from "@/components/ui";
import { createProject, createProjectFromTemplate, createWorkPackage, createLabel, addMember } from "@/plugins/projects/actions";
import { createSprint } from "@/plugins/sprints/actions";

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

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [template, setTemplate] = useState<"blank" | "se">("blank");
  const [pending, start] = useTransition();

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo projeto</Button>
      {open && (
        <Modal title="Novo projeto" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Sigla</Label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="BIO" maxLength={8} /></div>
              <div className="col-span-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" /></div>
            </div>
            <div><Label>Descricao</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
            <div><Label>Cor</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded-lg border border-border bg-surface2" /></div>
            <div>
              <Label>Template</Label>
              <Select value={template} onChange={(e) => setTemplate(e.target.value as "blank" | "se")} className="w-full">
                <option value="blank">Projeto em branco</option>
                <option value="se">Engenharia de Sistemas (WBS + gates + SoI)</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={pending || !key || !name} onClick={() => start(async () => { await createProjectFromTemplate(template, { key, name, description, color }); setOpen(false); router.refresh(); })}>Criar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AddWorkPackageForm({ projectId, parents }: { projectId: string; parents: { id: string; name: string; code: string | null }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-20"><Label>Codigo</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1.2" /></div>
      <div className="min-w-[180px] flex-1"><Label>Atividade (WBS)</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da atividade" /></div>
      <div className="w-48"><Label>Pai</Label>
        <Select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full">
          <option value="">(raiz)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.code ? p.code + " " : ""}{p.name}</option>)}
        </Select>
      </div>
      <Button disabled={pending || !name} onClick={() => start(async () => { await createWorkPackage({ projectId, name, code, parentId: parentId || null }); setName(""); setCode(""); router.refresh(); })}>Adicionar</Button>
    </div>
  );
}

export function AddLabelForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const [pending, start] = useTransition();
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1"><Label>Categoria</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Experimento" /></div>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-surface2" />
      <Button disabled={pending || !name} onClick={() => start(async () => { await createLabel({ projectId, name, color }); setName(""); router.refresh(); })}>Adicionar</Button>
    </div>
  );
}

export function AddMemberForm({ projectId, candidates }: { projectId: string; candidates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [role, setRole] = useState("contributor");
  const [pending, start] = useTransition();
  if (candidates.length === 0) return <p className="text-xs text-muted">Todos os usuarios ja sao membros.</p>;
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1"><Label>Usuario</Label>
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full">
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div><Label>Papel</Label>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="lead">Lider</option>
          <option value="contributor">Contribuidor</option>
          <option value="viewer">Leitor</option>
        </Select>
      </div>
      <Button disabled={pending} onClick={() => start(async () => { await addMember({ projectId, userId, role }); router.refresh(); })}>Adicionar</Button>
    </div>
  );
}

export function AddSprintForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 3" /></div>
        <div><Label>Meta</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Objetivo da sprint" /></div>
        <div><Label>Inicio</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Label>Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button disabled={pending || !name} onClick={() => start(async () => { await createSprint({ projectId, name, goal, startDate: startDate || null, endDate: endDate || null }); setName(""); setGoal(""); router.refresh(); })}>Criar sprint</Button>
      </div>
    </Card>
  );
}
