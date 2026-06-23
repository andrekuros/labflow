"use client";

import { useState, useTransition } from "react";
import { X, Trash2 } from "lucide-react";
import { Button, Input, Textarea, Select, Label, Badge, Avatar } from "@/components/ui";
import { createTask, updateTask, deleteTask } from "@/plugins/board/actions";
import { COLUMNS, PRIORITIES, type BoardTask, type Person, type LabelItem, type SprintItem, type ProjectItem } from "@/components/board/types";
import { AddCategoryDialog } from "@/components/board/add-category-dialog";
import { KnowledgeLinksPanel } from "@/components/knowledge/knowledge-links";

export function TaskDialog({
  task,
  defaultProjectId,
  defaultStatus,
  projects,
  members,
  labels,
  sprints,
  canWrite,
  onClose,
  onSaved,
}: {
  task: BoardTask | null;
  defaultProjectId?: string;
  defaultStatus?: string;
  projects: ProjectItem[];
  members: Person[];
  labels: LabelItem[];
  sprints: SprintItem[];
  canWrite: Record<string, boolean>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!task;
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? defaultStatus ?? "backlog");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [sprintId, setSprintId] = useState(task?.sprintId ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees.map((a) => a.id) ?? []);
  const [labelIds, setLabelIds] = useState<string[]>(task?.labels.map((l) => l.id) ?? []);
  const [pending, start] = useTransition();

  const projectLabels = labels.filter((l) => l.projectId === projectId);
  const projectSprints = sprints.filter((s) => s.projectId === projectId);
  const writable = canWrite[projectId] ?? false;

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function save() {
    if (!title.trim() || !projectId) return;
    start(async () => {
      if (editing && task) {
        await updateTask({
          taskId: task.id,
          title,
          description: description || null,
          priority,
          status,
          sprintId: sprintId || null,
          dueDate: dueDate || null,
          assigneeIds,
          labelIds,
        });
      } else {
        await createTask({
          projectId,
          title,
          description,
          status,
          priority,
          sprintId: sprintId || null,
          dueDate: dueDate || null,
          assigneeIds,
          labelIds,
        });
      }
      onSaved();
      onClose();
    });
  }

  function remove() {
    if (!task) return;
    start(async () => {
      await deleteTask(task.id);
      onSaved();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editing ? "Editar tarefa" : "Nova tarefa"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface2">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Projeto</Label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full" disabled={editing}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.key} - {p.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Titulo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" autoFocus />
          </div>

          <div>
            <Label>Descricao</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Detalhes, contexto, criterios..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full">
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Sprint</Label>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="w-full">
                <option value="">Sem sprint</option>
                {projectSprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Responsaveis</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = assigneeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(assigneeIds, m.id, setAssigneeIds)}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${on ? "border-brand bg-brand/15" : "border-border hover:bg-surface2"}`}
                  >
                    <Avatar name={m.name} color={m.avatarColor} />
                    {m.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Categorias</Label>
              {writable && (
                <AddCategoryDialog
                  projects={projects}
                  defaultProjectId={projectId}
                  canWrite={canWrite}
                  onCreated={(l) => setLabelIds((ids) => [...ids, l.id])}
                  trigger={
                    <button type="button" className="text-xs text-brand hover:underline">
                      + Nova
                    </button>
                  }
                />
              )}
            </div>
            {projectLabels.length === 0 ? (
              <p className="text-xs text-muted">Nenhuma categoria neste projeto. Crie uma acima.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projectLabels.map((l) => {
                  const on = labelIds.includes(l.id);
                  return (
                    <button key={l.id} onClick={() => toggle(labelIds, l.id, setLabelIds)} className={`rounded-md transition ${on ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100"}`}>
                      <Badge color={l.color}>{l.name}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {editing && task && (
            <KnowledgeLinksPanel
              targetType="task"
              targetId={task.id}
              projectId={projectId}
              canEdit={writable}
            />
          )}

          {!writable && (
            <p className="text-xs text-amber-400">Voce tem acesso somente leitura neste projeto.</p>
          )}

          <div className="flex items-center justify-between pt-2">
            {editing ? (
              <Button variant="danger" size="sm" onClick={remove} disabled={pending || !writable}>
                <Trash2 size={14} /> Excluir
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={save} disabled={pending || !title.trim() || !writable}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
