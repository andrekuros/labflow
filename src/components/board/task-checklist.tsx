"use client";

import { useState, useTransition } from "react";
import { Bot, Plus, Trash2, GripVertical } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  type TaskChecklistItem,
  parseChecklist,
  checklistProgress,
  newChecklistItem,
} from "@/lib/task-checklist";
import { updateTaskChecklist, generateTaskStepsWithAiAction } from "@/plugins/board/actions";

type Props = {
  taskId: string;
  initialItems: TaskChecklistItem[];
  writable: boolean;
};

export function TaskChecklist({ taskId, initialItems, writable }: Props) {
  const [items, setItems] = useState(initialItems);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const progress = checklistProgress(items);

  function persist(next: TaskChecklistItem[]) {
    setItems(next);
    setError(null);
    start(async () => {
      const res = await updateTaskChecklist(taskId, next);
      if (res.error) setError(res.error);
    });
  }

  function toggle(id: string) {
    persist(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  function addItem() {
    const title = newTitle.trim();
    if (!title) return;
    persist([...items, newChecklistItem(title, items.length)]);
    setNewTitle("");
  }

  function runAi() {
    if (items.length > 0 && !window.confirm("Substituir os passos atuais pelos gerados pela IA?")) return;
    setError(null);
    start(async () => {
      const res = await generateTaskStepsWithAiAction(taskId);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.items) setItems(res.items);
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>Checklist / Steps</Label>
        {items.length > 0 && (
          <span className="text-xs text-muted">
            {progress.done}/{progress.total} ({progress.pct}%)
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface2/30 px-2 py-1.5"
          >
            <GripVertical size={14} className="shrink-0 text-muted/50" />
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item.id)}
              disabled={!writable || pending}
              className="rounded border-border"
            />
            <span className={`min-w-0 flex-1 text-sm ${item.done ? "text-muted line-through" : ""}`}>
              {item.title}
            </span>
            {writable && (
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={pending}
                className="rounded p-1 text-muted hover:bg-surface2 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {writable && (
        <div className="mt-2 flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Novo passo..."
            className="flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            disabled={pending}
          />
          <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={pending || !newTitle.trim()}>
            <Plus size={14} />
          </Button>
        </div>
      )}

      {writable && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={runAi}
          disabled={pending}
        >
          <Bot size={14} /> {pending ? "Gerando..." : "Gerar steps com IA"}
        </Button>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
