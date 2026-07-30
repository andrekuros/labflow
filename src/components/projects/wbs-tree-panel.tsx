"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Input, Textarea, Select, Label } from "@/components/ui";
import {
  updateWorkPackage,
  deleteWorkPackage,
  moveWorkPackage,
} from "@/plugins/projects/actions";

export type WbsNode = {
  id: string;
  parentId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  status: string;
  order: number;
  progressPct: number;
  doneTasks: number;
  totalTasks: number;
  doneWeight: number;
  totalWeight: number;
};

const WBS_STATUS: Record<string, string> = {
  planned: "Planejada",
  in_progress: "Em andamento",
  done: "Concluida",
  blocked: "Bloqueada",
};

const STATUS_OPTIONS = [
  { value: "planned", label: "Planejada" },
  { value: "in_progress", label: "Em andamento" },
  { value: "done", label: "Concluida" },
  { value: "blocked", label: "Bloqueada" },
];

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface2">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EditWbsModal({
  node,
  allNodes,
  onClose,
}: {
  node: WbsNode;
  allNodes: WbsNode[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(node.name);
  const [code, setCode] = useState(node.code ?? "");
  const [description, setDescription] = useState(node.description ?? "");
  const [status, setStatus] = useState(node.status);
  const [parentId, setParentId] = useState(node.parentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const descendants = new Set<string>();
  const walk = (pid: string) => {
    for (const n of allNodes) {
      if (n.parentId === pid && !descendants.has(n.id)) {
        descendants.add(n.id);
        walk(n.id);
      }
    }
  };
  walk(node.id);

  const parentOptions = allNodes.filter((n) => n.id !== node.id && !descendants.has(n.id));

  function save() {
    setError(null);
    start(async () => {
      const res = await updateWorkPackage(node.id, {
        name,
        code: code || null,
        description: description || null,
        status,
        parentId: parentId || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Editar pacote WBS</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Codigo</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1.2" />
            </div>
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descricao</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Pai</Label>
              <Select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full">
                <option value="">(raiz)</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `${p.code} ` : ""}{p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={pending || !name.trim()}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

type TreeProps = {
  nodeId: string;
  depth: number;
  nodes: WbsNode[];
  writable: boolean;
  siblings: WbsNode[];
  siblingIndex: number;
  onEdit: (node: WbsNode) => void;
};

function WbsTreeRow({
  nodeId,
  depth,
  nodes,
  writable,
  siblings,
  siblingIndex,
  onEdit,
}: TreeProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const node = nodes.find((w) => w.id === nodeId)!;
  const kids = nodes
    .filter((w) => w.parentId === nodeId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  function move(direction: "up" | "down") {
    start(async () => {
      await moveWorkPackage(nodeId, direction);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Excluir "${node.name}"? Subpacotes passam para a raiz.`)) return;
    start(async () => {
      await deleteWorkPackage(nodeId);
      router.refresh();
    });
  }

  return (
    <div>
      <div
        className="group flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-surface2 sm:flex-row sm:items-center sm:justify-between"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          {node.code && <span className="font-mono text-xs text-muted">{node.code}</span>}
          <span>{node.name}</span>
          <Badge className="bg-surface2 text-muted">{WBS_STATUS[node.status] ?? node.status}</Badge>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {node.totalTasks > 0 ? (
            <>
              <ProgressBar pct={node.progressPct} />
              <span>{node.progressPct}%</span>
              <span>
                {node.doneTasks}/{node.totalTasks} tarefas
                {node.totalWeight > 0 && (
                  <> · {Math.round(node.doneWeight)}h/{Math.round(node.totalWeight)}h</>
                )}
              </span>
            </>
          ) : (
            <span>0 tarefas</span>
          )}
          {writable && (
            <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
              <button
                type="button"
                title="Subir"
                disabled={pending || siblingIndex <= 0}
                onClick={() => move("up")}
                className="rounded p-1 hover:bg-surface2 disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                title="Descer"
                disabled={pending || siblingIndex >= siblings.length - 1}
                onClick={() => move("down")}
                className="rounded p-1 hover:bg-surface2 disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                title="Editar"
                disabled={pending}
                onClick={() => onEdit(node)}
                className="rounded p-1 hover:bg-surface2"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                title="Excluir"
                disabled={pending}
                onClick={remove}
                className="rounded p-1 hover:bg-surface2 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      {kids.map((k, i) => (
        <WbsTreeRow
          key={k.id}
          nodeId={k.id}
          depth={depth + 1}
          nodes={nodes}
          writable={writable}
          siblings={kids}
          siblingIndex={i}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

export function WbsTreePanel({
  nodes,
  writable,
}: {
  nodes: WbsNode[];
  writable: boolean;
}) {
  const [editing, setEditing] = useState<WbsNode | null>(null);
  const roots = nodes
    .filter((w) => !w.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return (
    <>
      <div className="space-y-0.5">
        {roots.length === 0 && <p className="text-sm text-muted">Nenhuma atividade ainda.</p>}
        {roots.map((r, i) => (
          <WbsTreeRow
            key={r.id}
            nodeId={r.id}
            depth={0}
            nodes={nodes}
            writable={writable}
            siblings={roots}
            siblingIndex={i}
            onEdit={setEditing}
          />
        ))}
      </div>
      {editing && (
        <EditWbsModal node={editing} allNodes={nodes} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
