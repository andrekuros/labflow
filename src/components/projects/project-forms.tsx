"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label } from "@/components/ui";
import { createProjectFromTemplate, createWorkPackage, createLabel, addMember } from "@/plugins/projects/actions";
import { createSprint } from "@/plugins/sprints/actions";
import { PROJECT_TEMPLATES, type ProjectTemplateKey } from "@/plugins/projects/templates";
import {
  PROJECT_FEATURES,
  PROJECT_FEATURE_LABELS,
  defaultFeaturesForKind,
  type ProjectFeatures,
} from "@/lib/projects/features";
import { memberRolesForKind, PROJECT_MEMBER_ROLE_LABELS } from "@/lib/projects/membership-roles";

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

export function NewProjectButton({
  defaultKind,
}: {
  defaultKind?: "lab" | "admin" | "thesis" | "dissertation" | "paper";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [creationType, setCreationType] = useState<"lab" | "admin" | "thesis" | "dissertation" | "paper">(
    defaultKind ?? "lab",
  );
  const [template, setTemplate] = useState<ProjectTemplateKey>("blank");
  const [features, setFeatures] = useState(() => defaultFeaturesForKind(defaultKind ?? "lab"));
  const [pending, start] = useTransition();
  const labTemplates = PROJECT_TEMPLATES.filter((t) => t.kind === "lab");
  const selectedTpl = PROJECT_TEMPLATES.find((t) => t.key === template) ?? PROJECT_TEMPLATES[0];

  function resetAndClose() {
    setOpen(false);
    setStep(1);
    setKey("");
    setName("");
    setDescription("");
  }

  function onTypeChange(v: typeof creationType) {
    setCreationType(v);
    setFeatures(defaultFeaturesForKind(v));
    if (v === "admin") setTemplate("admin");
    else if (v === "lab") setTemplate("blank");
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo projeto</Button>
      {open && (
        <Modal title={`Novo projeto — passo ${step}/3`} onClose={resetAndClose}>
          <div className="space-y-3">
            {step === 1 && (
              <>
                <p className="text-xs text-muted">Tipo define a identidade do projeto (lab, tese, artigo…). Template e modulos vêm depois.</p>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={creationType}
                    onChange={(e) => onTypeChange(e.target.value as typeof creationType)}
                    className="w-full"
                  >
                    <option value="lab">Projeto de laboratorio</option>
                    <option value="admin">Projeto administrativo</option>
                    <option value="dissertation">Dissertacao</option>
                    <option value="thesis">Tese</option>
                    <option value="paper">Artigo</option>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Sigla</Label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="BIO" maxLength={8} /></div>
                  <div className="col-span-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" /></div>
                </div>
                <div><Label>Descricao</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
                <div><Label>Cor</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded-lg border border-border bg-surface2" /></div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
                  <Button disabled={!key || !name} onClick={() => setStep(2)}>Proximo</Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-xs text-muted">Template so aplica estrutura inicial (marcos, exemplos). Nao muda o tipo.</p>
                {creationType === "lab" ? (
                  <div>
                    <Label>Template</Label>
                    <Select value={template} onChange={(e) => setTemplate(e.target.value as ProjectTemplateKey)} className="w-full">
                      {labTemplates.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-muted">{selectedTpl.description}</p>
                  </div>
                ) : creationType === "admin" ? (
                  <p className="text-sm text-muted">Projeto administrativo: board, knowledge e forum. Sem WBS/SE.</p>
                ) : creationType === "paper" ? (
                  <p className="text-sm text-muted">Artigo: pipeline de publicacao + metodologia, sem WBS de engenharia.</p>
                ) : (
                  <p className="text-sm text-muted">Tese/dissertacao: metodologia, disciplinas e tarefas. Sem WBS/SE.</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                  <Button onClick={() => setStep(3)}>Proximo</Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-xs text-muted">Ajuste os modulos sugeridos para este tipo. Voce pode mudar depois nas configuracoes.</p>
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                  {PROJECT_FEATURES.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={features[f]}
                        onChange={(e) => setFeatures({ ...features, [f]: e.target.checked })}
                      />
                      {PROJECT_FEATURE_LABELS[f]}
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                  <Button
                    disabled={pending || !key || !name}
                    onClick={() =>
                      start(async () => {
                        if (creationType === "thesis" || creationType === "dissertation") {
                          const { createThesisOrDissertation } = await import("@/plugins/thesis/actions");
                          const res = await createThesisOrDissertation({
                            kind: creationType, key, name, description, color, features,
                          });
                          resetAndClose();
                          if ("id" in res && res.id) router.push(`/projects/${res.id}`);
                          else router.refresh();
                          return;
                        }
                        if (creationType === "paper") {
                          const { createPaperProject } = await import("@/plugins/papers/actions");
                          const res = await createPaperProject({ key, name, description, color, features });
                          resetAndClose();
                          if ("id" in res && res.id) router.push(`/projects/${res.id}?tab=paper`);
                          else router.refresh();
                          return;
                        }
                        await createProjectFromTemplate(
                          creationType === "admin" ? "admin" : template,
                          {
                            key, name, description, color,
                            kind: creationType === "admin" ? "admin" : "lab",
                            features,
                          },
                        );
                        resetAndClose();
                        router.refresh();
                      })
                    }
                  >
                    Criar
                  </Button>
                </div>
              </>
            )}
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

export function AddMemberForm({
  projectId,
  candidates,
  canAssignLead = false,
  projectKind = "lab",
}: {
  projectId: string;
  candidates: { id: string; name: string }[];
  canAssignLead?: boolean;
  projectKind?: string;
}) {
  const router = useRouter();
  const roles = memberRolesForKind(projectKind, canAssignLead);
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [role, setRole] = useState<string>(roles.includes("contributor") ? "contributor" : roles[0] ?? "viewer");
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
          {roles.map((r) => (
            <option key={r} value={r}>{PROJECT_MEMBER_ROLE_LABELS[r]}</option>
          ))}
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
