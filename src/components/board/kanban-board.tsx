"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  Plus,
  Search,
  CalendarClock,
  Columns3,
  LayoutTemplate,
  Eye,
  Trash2,
  Bookmark,
} from "lucide-react";
import { Button, Input, Badge, Avatar, PageHeader } from "@/components/ui";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { checklistProgress } from "@/lib/task-checklist";
import { moveTask } from "@/plugins/board/actions";
import { deleteBoardView, saveBoardView } from "@/plugins/board/view-actions";
import { TaskDialog } from "@/components/board/task-dialog";
import { AddCategoryDialog } from "@/components/board/add-category-dialog";
import { MultiFilter } from "@/components/board/multi-filter";
import {
  PRIORITIES,
  type BoardTask,
  type Person,
  type LabelItem,
  type SprintItem,
  type WorkPackageItem,
  type ProjectItem,
} from "@/components/board/types";
import { resolveBoardColumnsForView } from "@/lib/board-columns";
import {
  boardStateFromSearchParams,
  boardStateToSearchParams,
  boardStatesEqual,
  CARD_FIELD_LABELS,
  CARD_FIELD_IDS,
  defaultBoardViewState,
  migrateLegacyBoardParams,
  type BoardViewState,
  type CardFieldId,
  type SavedBoardView,
} from "@/lib/board-view";

export function KanbanBoard({
  currentUserId,
  tasks: initialTasks,
  projects,
  members,
  labels,
  sprints,
  workPackages,
  canWrite,
  projectColumns,
  savedViews: initialViews,
  initialProject = "",
  projectLocked = false,
}: {
  currentUserId: string;
  tasks: BoardTask[];
  projects: ProjectItem[];
  members: Person[];
  labels: LabelItem[];
  sprints: SprintItem[];
  workPackages: WorkPackageItem[];
  canWrite: Record<string, boolean>;
  projectColumns: Record<string, string[]>;
  savedViews: SavedBoardView[];
  initialProject?: string;
  /** When true, project filter is fixed to initialProject (workspace mode). */
  projectLocked?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [tasks, setTasks] = useState(initialTasks);
  const [views, setViews] = useState(initialViews);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ task: BoardTask | null; status?: string } | null>(null);
  const [panel, setPanel] = useState<"columns" | "cards" | "views" | null>(null);
  const [viewName, setViewName] = useState("");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const applyingUrl = useRef(false);
  const lastWrittenQs = useRef<string | null>(null);

  function withLockedProject(next: BoardViewState): BoardViewState {
    if (!(projectLocked && initialProject)) return next;
    return { ...next, filters: { ...next.filters, projects: [initialProject] } };
  }

  function resolveFromParams(raw: URLSearchParams, viewList: SavedBoardView[]): {
    state: BoardViewState;
    viewId: string | null;
    viewName: string;
  } {
    const migrated = migrateLegacyBoardParams(raw);
    const viewSlug = migrated.get("view");
    if (viewSlug) {
      const saved = viewList.find((v) => v.slug === viewSlug);
      if (saved) {
        return {
          state: withLockedProject({
            filters: { ...saved.filters },
            hiddenColumns: [...saved.hiddenColumns],
            cardFields: [...saved.cardFields],
          }),
          viewId: saved.id,
          viewName: saved.name,
        };
      }
    }
    const fromUrl = boardStateFromSearchParams(migrated);
    if (!fromUrl.filters.projects.length && initialProject) {
      fromUrl.filters.projects = [initialProject];
    }
    return { state: withLockedProject(fromUrl), viewId: null, viewName: "" };
  }

  const [state, setState] = useState<BoardViewState>(() =>
    resolveFromParams(new URLSearchParams(searchParams.toString()), initialViews).state,
  );

  useEffect(() => {
    setViews(initialViews);
  }, [initialViews]);

  useEffect(() => {
    const qs = searchParams.toString();
    if (lastWrittenQs.current !== null && qs === lastWrittenQs.current) return;
    const resolved = resolveFromParams(new URLSearchParams(qs), views);
    applyingUrl.current = true;
    setActiveViewId(resolved.viewId);
    setViewName(resolved.viewName);
    setState(resolved.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const desiredQs = useMemo(() => {
    const active = activeViewId ? views.find((v) => v.id === activeViewId) : null;
    const matchesActive =
      active &&
      boardStatesEqual(
        state,
        withLockedProject({
          filters: active.filters,
          hiddenColumns: active.hiddenColumns,
          cardFields: active.cardFields,
        }),
      );
    if (matchesActive && active) {
      const p = new URLSearchParams();
      p.set("view", active.slug);
      return p.toString();
    }
    return boardStateToSearchParams(state).toString();
  }, [state, activeViewId, views, projectLocked, initialProject]);

  useEffect(() => {
    if (applyingUrl.current) {
      applyingUrl.current = false;
      lastWrittenQs.current = desiredQs;
      return;
    }
    const current = searchParams.toString();
    if (desiredQs === current) {
      lastWrittenQs.current = desiredQs;
      return;
    }
    // Drop named view if user changed filters away from the saved template.
    const active = activeViewId ? views.find((v) => v.id === activeViewId) : null;
    if (
      active &&
      !boardStatesEqual(
        state,
        withLockedProject({
          filters: active.filters,
          hiddenColumns: active.hiddenColumns,
          cardFields: active.cardFields,
        }),
      )
    ) {
      setActiveViewId(null);
    }
    lastWrittenQs.current = desiredQs;
    const href = desiredQs ? `/board?${desiredQs}` : "/board";
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }, [desiredQs, searchParams, router, activeViewId, views, state]);

  function patchState(patch: Partial<BoardViewState> | ((prev: BoardViewState) => BoardViewState)) {
    setState((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      return withLockedProject(next);
    });
  }

  function patchFilters(partial: Partial<BoardViewState["filters"]>) {
    patchState((prev) => ({
      ...prev,
      filters: { ...prev.filters, ...partial },
    }));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const projectFilter = projectLocked && initialProject ? [initialProject] : state.filters.projects;
  const singleProject = projectFilter.length === 1 ? projectFilter[0] : "";

  const filtered = useMemo(() => {
    const { assignees, labels: labelIds, sprints: sprintIds, priorities, search } = state.filters;
    return tasks.filter((t) => {
      if (projectFilter.length && !projectFilter.includes(t.projectId)) return false;
      if (assignees.length) {
        const ok = assignees.some((a) =>
          a === "me"
            ? t.assignees.some((x) => x.id === currentUserId)
            : t.assignees.some((x) => x.id === a),
        );
        if (!ok) return false;
      }
      if (labelIds.length && !t.labels.some((l) => labelIds.includes(l.id))) return false;
      if (sprintIds.length && (!t.sprintId || !sprintIds.includes(t.sprintId))) return false;
      if (priorities.length && !priorities.includes(t.priority)) return false;
      if (search && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [tasks, projectFilter, state.filters, currentUserId]);

  const allColumns = useMemo(() => {
    const statuses = [...new Set(filtered.map((t) => t.status))];
    return resolveBoardColumnsForView(projectColumns, singleProject, statuses);
  }, [filtered, projectColumns, singleProject]);

  const columns = useMemo(
    () => allColumns.filter((c) => !state.hiddenColumns.includes(c.id)),
    [allColumns, state.hiddenColumns],
  );

  const byColumn = useMemo(() => {
    const map: Record<string, BoardTask[]> = {};
    for (const c of columns) map[c.id] = [];
    for (const t of filtered) {
      if (state.hiddenColumns.includes(t.status)) continue;
      (map[t.status] ?? (map[t.status] = [])).push(t);
    }
    for (const col of Object.keys(map)) {
      map[col].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    }
    return map;
  }, [filtered, columns, state.hiddenColumns]);

  function applyTaskOrder(
    prev: BoardTask[],
    taskId: string,
    newStatus: string,
    targetOrder: number,
  ): BoardTask[] {
    const task = prev.find((t) => t.id === taskId);
    if (!task) return prev;

    const oldStatus = task.status;
    const next = prev.map((t) => ({ ...t }));

    if (oldStatus !== newStatus) {
      const oldColumn = next
        .filter((t) => t.status === oldStatus && t.id !== taskId)
        .sort((a, b) => a.order - b.order);
      oldColumn.forEach((t, i) => {
        const row = next.find((x) => x.id === t.id);
        if (row) row.order = i;
      });

      const newColumn = next
        .filter((t) => t.status === newStatus && t.id !== taskId)
        .sort((a, b) => a.order - b.order);
      const moving = { ...task, status: newStatus };
      const insertAt = Math.min(targetOrder, newColumn.length);
      newColumn.splice(insertAt, 0, moving);
      newColumn.forEach((t, i) => {
        const row = next.find((x) => x.id === t.id);
        if (row) {
          row.status = newStatus;
          row.order = i;
        }
      });
      return next;
    }

    const column = next
      .filter((t) => t.status === oldStatus)
      .sort((a, b) => a.order - b.order);
    const oldIndex = column.findIndex((t) => t.id === taskId);
    if (oldIndex === -1) return prev;
    const [moving] = column.splice(oldIndex, 1);
    const insertAt = Math.min(targetOrder, column.length);
    column.splice(insertAt, 0, moving);
    column.forEach((t, i) => {
      const row = next.find((x) => x.id === t.id);
      if (row) row.order = i;
    });
    return next;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || !canWrite[task.projectId]) return;

    let newStatus = task.status;
    let targetOrder = 0;

    if (overId.startsWith("col:")) {
      newStatus = overId.slice(4);
      targetOrder = byColumn[newStatus]?.filter((t) => t.id !== taskId).length ?? 0;
    } else if (overId === taskId) {
      return;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      newStatus = overTask.status;
      const column = byColumn[newStatus] ?? [];
      targetOrder = column.findIndex((t) => t.id === overId);
      if (targetOrder < 0) targetOrder = column.length;
    }

    const currentIndex = (byColumn[task.status] ?? []).findIndex((t) => t.id === taskId);
    if (newStatus === task.status && targetOrder === currentIndex) return;

    const snapshot = tasks;
    setTasks((prev) => applyTaskOrder(prev, taskId, newStatus, targetOrder));
    try {
      await moveTask({ taskId, status: newStatus, order: targetOrder });
    } catch {
      setTasks(snapshot);
      router.refresh();
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const labelOptions = singleProject ? labels.filter((l) => l.projectId === singleProject) : labels;
  const sprintOptions = singleProject ? sprints.filter((s) => s.projectId === singleProject) : sprints;

  const cardFieldSet = useMemo(() => new Set(state.cardFields), [state.cardFields]);

  async function handleSaveView(asNew: boolean) {
    const name = viewName.trim() || views.find((v) => v.id === activeViewId)?.name || "Meu kanban";
    const result = await saveBoardView({
      id: asNew ? undefined : activeViewId ?? undefined,
      name,
      state,
    });
    if (result.error || !result.view) return;
    setViews((prev) => {
      const without = prev.filter((v) => v.id !== result.view!.id);
      return [...without, result.view!].sort((a, b) => a.name.localeCompare(b.name));
    });
    setActiveViewId(result.view.id);
    setViewName(result.view.name);
  }

  async function handleDeleteView(id: string) {
    const result = await deleteBoardView(id);
    if (result.error) return;
    setViews((prev) => prev.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  }

  function applyView(view: SavedBoardView) {
    setActiveViewId(view.id);
    setViewName(view.name);
    setState(
      withLockedProject({
        filters: { ...view.filters },
        hiddenColumns: [...view.hiddenColumns],
        cardFields: [...view.cardFields],
      }),
    );
  }

  function resetView() {
    setActiveViewId(null);
    setViewName("");
    setState(withLockedProject(defaultBoardViewState()));
  }

  function toggleHiddenColumn(id: string) {
    patchState((prev) => {
      const set = new Set(prev.hiddenColumns);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, hiddenColumns: [...set] };
    });
  }

  function toggleCardField(id: CardFieldId) {
    patchState((prev) => {
      const set = new Set(prev.cardFields);
      if (set.has(id)) {
        if (set.size <= 1) return prev;
        set.delete(id);
      } else {
        set.add(id);
      }
      return { ...prev, cardFields: CARD_FIELD_IDS.filter((f) => set.has(f)) };
    });
  }

  return (
    <div>
      <PageHeader
        title="Kanban"
        actions={
          <Button onClick={() => setDialog({ task: null })}>
            <Plus size={16} /> Nova tarefa
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2 text-muted" />
          <Input
            value={state.filters.search}
            onChange={(e) => patchFilters({ search: e.target.value })}
            placeholder="Buscar..."
            className="h-9 w-48 pl-8"
          />
        </div>
        <MultiFilter
          label="Projetos"
          values={projectFilter}
          disabled={projectLocked}
          title={projectLocked ? "Projeto fixado pelo contexto de trabalho" : undefined}
          onChange={(projects) => patchFilters({ projects, labels: [], sprints: [] })}
          options={projects.map((p) => ({ value: p.id, label: p.key }))}
        />
        <MultiFilter
          label="Pessoas"
          values={state.filters.assignees}
          onChange={(assignees) => patchFilters({ assignees })}
          options={[
            { value: "me", label: "Minhas tarefas" },
            ...members.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
        <MultiFilter
          label="Categorias"
          values={state.filters.labels}
          onChange={(labels) => patchFilters({ labels })}
          options={labelOptions.map((l) => ({ value: l.id, label: l.name }))}
        />
        <AddCategoryDialog
          projects={projects}
          defaultProjectId={singleProject || undefined}
          canWrite={canWrite}
          onCreated={(l) =>
            patchFilters({ labels: [...new Set([...state.filters.labels, l.id])] })
          }
        />
        <MultiFilter
          label="Sprints"
          values={state.filters.sprints}
          onChange={(sprints) => patchFilters({ sprints })}
          options={sprintOptions.map((s) => ({ value: s.id, label: s.name }))}
        />
        <MultiFilter
          label="Prioridade"
          values={state.filters.priorities}
          onChange={(priorities) => patchFilters({ priorities })}
          options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))}
        />

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            variant={panel === "columns" ? "primary" : "outline"}
            size="sm"
            onClick={() => setPanel((p) => (p === "columns" ? null : "columns"))}
            title="Colunas visiveis"
          >
            <Columns3 size={14} /> Colunas
          </Button>
          <Button
            variant={panel === "cards" ? "primary" : "outline"}
            size="sm"
            onClick={() => setPanel((p) => (p === "cards" ? null : "cards"))}
            title="Campos do cartao"
          >
            <Eye size={14} /> Cartoes
          </Button>
          <Button
            variant={panel === "views" ? "primary" : "outline"}
            size="sm"
            onClick={() => setPanel((p) => (p === "views" ? null : "views"))}
            title="Modelos salvos"
          >
            <LayoutTemplate size={14} /> Modelos
          </Button>
        </div>
      </div>

      {panel === "columns" && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-surface2/40 p-3">
          <p className="w-full text-xs text-muted">Oculte colunas (ex.: Backlog) sem apagar tarefas.</p>
          {allColumns.map((col) => {
            const hidden = state.hiddenColumns.includes(col.id);
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => toggleHiddenColumn(col.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                  hidden
                    ? "border-border bg-surface text-muted line-through"
                    : "border-brand/40 bg-brand/10 text-fg",
                )}
              >
                {col.title}
              </button>
            );
          })}
        </div>
      )}

      {panel === "cards" && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-surface2/40 p-3">
          <p className="w-full text-xs text-muted">Escolha o que aparece nos cartoes.</p>
          {CARD_FIELD_IDS.map((id) => {
            const on = cardFieldSet.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleCardField(id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                  on ? "border-brand/40 bg-brand/10 text-fg" : "border-border bg-surface text-muted",
                )}
              >
                {CARD_FIELD_LABELS[id]}
              </button>
            );
          })}
        </div>
      )}

      {panel === "views" && (
        <div className="mb-3 space-y-3 rounded-xl border border-border bg-surface2/40 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-muted">Nome do modelo</label>
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Ex.: Meu foco semanal"
              />
            </div>
            <Button size="sm" onClick={() => void handleSaveView(true)}>
              <Bookmark size={14} /> Salvar novo
            </Button>
            {activeViewId && (
              <Button size="sm" variant="outline" onClick={() => void handleSaveView(false)}>
                Atualizar atual
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={resetView}>
              Limpar
            </Button>
          </div>
          {views.length === 0 ? (
            <p className="text-xs text-muted">Nenhum modelo salvo. Filtros tambem ficam na URL.</p>
          ) : (
            <ul className="space-y-1">
              {views.map((v) => (
                <li
                  key={v.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                    activeViewId === v.id ? "bg-brand/10" : "hover:bg-surface",
                  )}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => applyView(v)}>
                    <span className="font-medium">{v.name}</span>
                    <span className="ml-2 text-xs text-muted">/board?view={v.slug}</span>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:bg-surface2 hover:text-red-400"
                    title="Excluir modelo"
                    onClick={() => void handleDeleteView(v.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DndContext
        id="labflow-kanban"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              count={byColumn[col.id]?.length ?? 0}
              onAdd={() => setDialog({ task: null, status: col.id })}
            >
              {(byColumn[col.id] ?? []).map((t) => (
                <Card
                  key={t.id}
                  task={t}
                  fields={cardFieldSet}
                  onClick={() => setDialog({ task: t })}
                />
              ))}
            </Column>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <CardPreview task={activeTask} fields={cardFieldSet} /> : null}
        </DragOverlay>
      </DndContext>

      {dialog && (
        <TaskDialog
          task={dialog.task}
          defaultStatus={dialog.status}
          defaultProjectId={singleProject || undefined}
          projects={projects}
          members={members}
          labels={labels}
          sprints={sprints}
          workPackages={workPackages}
          canWrite={canWrite}
          projectColumns={projectColumns}
          checklist={dialog.task?.checklist ?? []}
          onClose={() => setDialog(null)}
          onSaved={(action, t) => {
            if (action === "created" && t) {
              setTasks((prev) => [...prev, t]);
            } else if (action === "updated" && t) {
              const prevChecklist = dialog?.task?.checklist;
              setTasks((prev) =>
                prev.map((x) => (x.id === t.id ? { ...t, checklist: prevChecklist ?? x.checklist } : x)),
              );
            } else if (action === "deleted" && t) {
              setTasks((prev) => prev.filter((x) => x.id !== t.id));
            }
          }}
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

function Card({
  task,
  fields,
  onClick,
}: {
  task: BoardTask;
  fields: Set<CardFieldId>;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <CardPreview task={task} fields={fields} />
    </div>
  );
}

function CardPreview({ task, fields }: { task: BoardTask; fields: Set<CardFieldId> }) {
  const d = daysUntil(task.dueDate);
  const prio = PRIORITIES[task.priority];
  const steps = checklistProgress(task.checklist ?? []);
  const showHeader = fields.has("project") || fields.has("priority");
  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
      {showHeader && (
        <div className="mb-2 flex items-center gap-1.5">
          {fields.has("project") && <Badge color={task.projectColor}>{task.projectKey}</Badge>}
          {fields.has("priority") && (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: prio?.color }}
              title={prio?.label}
            />
          )}
        </div>
      )}
      <p className="text-sm leading-snug">{task.title}</p>
      {fields.has("checklist") && steps.total > 0 && (
        <p className="mt-1.5 text-[11px] text-muted">
          Checklist {steps.done}/{steps.total}
        </p>
      )}
      {fields.has("labels") && task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <Badge key={l.id} color={l.color}>
              {l.name}
            </Badge>
          ))}
        </div>
      )}
      {(fields.has("assignees") || fields.has("dueDate")) && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {fields.has("assignees") &&
              task.assignees.map((a) => (
                <Avatar key={a.id} name={a.name} color={a.avatarColor} />
              ))}
          </div>
          {fields.has("dueDate") && task.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px]",
                d !== null && d < 0
                  ? "text-red-400"
                  : d !== null && d <= 3
                    ? "text-amber-400"
                    : "text-muted",
              )}
            >
              <CalendarClock size={12} /> {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
