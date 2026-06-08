"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Search, CalendarClock } from "lucide-react";
import { Button, Select, Input, Badge, Avatar, PageHeader } from "@/components/ui";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { moveTask } from "@/app/actions/tasks";
import { TaskDialog } from "@/components/board/task-dialog";
import { AddCategoryDialog } from "@/components/board/add-category-dialog";
import {
  COLUMNS,
  PRIORITIES,
  type BoardTask,
  type Person,
  type LabelItem,
  type SprintItem,
  type ProjectItem,
} from "@/components/board/types";

export function KanbanBoard({
  currentUserId,
  tasks: initialTasks,
  projects,
  members,
  labels,
  sprints,
  canWrite,
  initialAssignee = "",
  initialProject = "",
}: {
  currentUserId: string;
  tasks: BoardTask[];
  projects: ProjectItem[];
  members: Person[];
  labels: LabelItem[];
  sprints: SprintItem[];
  canWrite: Record<string, boolean>;
  initialAssignee?: string;
  initialProject?: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ task: BoardTask | null; status?: string } | null>(null);

  const [fProject, setFProject] = useState(initialProject);
  const [fAssignee, setFAssignee] = useState(initialAssignee);
  const [fLabel, setFLabel] = useState("");
  const [fSprint, setFSprint] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [search, setSearch] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (fProject && t.projectId !== fProject) return false;
      if (fAssignee === "me" && !t.assignees.some((a) => a.id === currentUserId)) return false;
      if (fAssignee && fAssignee !== "me" && !t.assignees.some((a) => a.id === fAssignee)) return false;
      if (fLabel && !t.labels.some((l) => l.id === fLabel)) return false;
      if (fSprint && t.sprintId !== fSprint) return false;
      if (fPriority && t.priority !== fPriority) return false;
      if (search && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, fProject, fAssignee, fLabel, fSprint, fPriority, search, currentUserId]);

  const byColumn = useMemo(() => {
    const map: Record<string, BoardTask[]> = {};
    for (const c of COLUMNS) map[c.id] = [];
    for (const t of filtered) (map[t.status] ?? (map[t.status] = [])).push(t);
    return map;
  }, [filtered]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const newStatus = overId.startsWith("col:") ? overId.slice(4) : tasks.find((t) => t.id === overId)?.status;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !newStatus || newStatus === task.status) return;
    if (!canWrite[task.projectId]) return;

    const order = byColumn[newStatus]?.length ?? 0;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await moveTask({ taskId, status: newStatus, order });
    } catch {
      router.refresh();
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const labelOptions = fProject ? labels.filter((l) => l.projectId === fProject) : labels;
  const sprintOptions = fProject ? sprints.filter((s) => s.projectId === fProject) : sprints;

  return (
    <div>
      <PageHeader
        title="Kanban"
        description="Arraste cartoes entre as colunas. Filtre por projeto, pessoa, categoria, sprint e prioridade."
        actions={
          <Button onClick={() => setDialog({ task: null })}>
            <Plus size={16} /> Nova tarefa
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-9 w-48 pl-8" />
        </div>
        <Select value={fProject} onChange={(e) => { setFProject(e.target.value); setFLabel(""); setFSprint(""); }}>
          <option value="">Todos os projetos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}
        </Select>
        <Select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
          <option value="">Todas as pessoas</option>
          <option value="me">Minhas tarefas</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select value={fLabel} onChange={(e) => setFLabel(e.target.value)}>
          <option value="">Todas as categorias</option>
          {labelOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <AddCategoryDialog
          projects={projects}
          defaultProjectId={fProject || undefined}
          canWrite={canWrite}
          onCreated={(l) => setFLabel(l.id)}
        />
        <Select value={fSprint} onChange={(e) => setFSprint(e.target.value)}>
          <option value="">Todas as sprints</option>
          {sprintOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="">Toda prioridade</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              count={byColumn[col.id]?.length ?? 0}
              onAdd={() => setDialog({ task: null, status: col.id })}
            >
              {(byColumn[col.id] ?? []).map((t) => (
                <Card key={t.id} task={t} onClick={() => setDialog({ task: t })} />
              ))}
            </Column>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <CardPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {dialog && (
        <TaskDialog
          task={dialog.task}
          defaultStatus={dialog.status}
          defaultProjectId={fProject || undefined}
          projects={projects}
          members={members}
          labels={labels}
          sprints={sprints}
          canWrite={canWrite}
          onClose={() => setDialog(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function Column({
  id,
  title,
  count,
  onAdd,
  children,
}: {
  id: string;
  title: string;
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className="rounded-md bg-surface2 px-1.5 text-xs text-muted">{count}</span>
        </div>
        <button onClick={onAdd} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-fg">
          <Plus size={15} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-xl border border-border/60 bg-surface2/30 p-2 transition",
          isOver && "border-brand bg-brand/5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Card({ task, onClick }: { task: BoardTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <CardPreview task={task} />
    </div>
  );
}

function CardPreview({ task }: { task: BoardTask }) {
  const d = daysUntil(task.dueDate);
  const prio = PRIORITIES[task.priority];
  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <Badge color={task.projectColor}>{task.projectKey}</Badge>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prio?.color }} title={prio?.label} />
      </div>
      <p className="text-sm leading-snug">{task.title}</p>
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => <Badge key={l.id} color={l.color}>{l.name}</Badge>)}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {task.assignees.map((a) => <Avatar key={a.id} name={a.name} color={a.avatarColor} />)}
        </div>
        {task.dueDate && (
          <span className={cn("flex items-center gap-1 text-[11px]", d !== null && d < 0 ? "text-red-400" : d !== null && d <= 3 ? "text-amber-400" : "text-muted")}>
            <CalendarClock size={12} /> {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
