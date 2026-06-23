"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label, Badge } from "@/components/ui";
import { createSystemElement, createInterface } from "@/plugins/system-model/actions";
import { SYS_KIND, IFACE_KIND } from "@/lib/se/constants";

type Element = {
  id: string; name: string; description: string | null; kind: string; parentId: string | null; projectId: string;
  project: { key: string; color: string };
};
type Iface = {
  id: string; name: string; kind: string; protocol: string | null;
  from: { id: string; name: string }; to: { id: string; name: string };
  projectId: string;
};

export function SystemModelClient({
  elements,
  interfaces,
  projects,
  canWrite,
  contextDiagram,
  bddDiagram,
}: {
  elements: Element[];
  interfaces: Iface[];
  projects: { id: string; key: string; name: string }[];
  canWrite: Record<string, boolean>;
  contextDiagram: string;
  bddDiagram: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [pending, start] = useTransition();

  const filtered = elements.filter((e) => e.projectId === projectId);
  const ifaces = interfaces.filter((i) => i.projectId === projectId);
  const roots = filtered.filter((e) => !e.parentId);

  function childrenOf(pid: string) {
    return filtered.filter((e) => e.parentId === pid);
  }

  function Tree({ id, depth }: { id: string; depth: number }) {
    const node = filtered.find((e) => e.id === id)!;
    return (
      <div>
        <div className="flex items-center gap-2 py-1 text-sm" style={{ marginLeft: depth * 16 }}>
          <Badge className="bg-surface2 text-muted">{SYS_KIND[node.kind] ?? node.kind}</Badge>
          <span className="font-medium">{node.name}</span>
        </div>
        {childrenOf(id).map((c) => <Tree key={c.id} id={c.id} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="min-w-[200px]">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
          </Select>
          {canWrite[projectId] && (
            <AddElementButton projectId={projectId} parents={filtered} onDone={() => router.refresh()} />
          )}
        </div>
        {roots.length === 0 ? <p className="text-sm text-muted">Nenhum elemento. Crie o System of Interest.</p> : roots.map((r) => <Tree key={r.id} id={r.id} depth={0} />)}

        <h3 className="mb-2 mt-6 text-sm font-semibold">Interfaces</h3>
        {ifaces.length === 0 && <p className="text-sm text-muted">Nenhuma interface.</p>}
        <ul className="space-y-2">
          {ifaces.map((i) => (
            <li key={i.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <span className="font-medium">{i.name}</span>
              <span className="text-muted"> — {i.from.name} → {i.to.name}</span>
              <Badge className="ml-2 bg-surface2 text-muted">{IFACE_KIND[i.kind] ?? i.kind}</Badge>
            </li>
          ))}
        </ul>
        {canWrite[projectId] && filtered.length >= 2 && (
          <AddInterfaceButton projectId={projectId} elements={filtered} onDone={() => router.refresh()} />
        )}
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">Diagrama de contexto (mermaid)</h3>
          <pre className="overflow-x-auto rounded-lg bg-surface2 p-3 text-xs">{contextDiagram}</pre>
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">BDD — Block Definition (mermaid)</h3>
          <pre className="overflow-x-auto rounded-lg bg-surface2 p-3 text-xs">{bddDiagram}</pre>
        </Card>
      </div>
    </div>
  );
}

function AddElementButton({ projectId, parents, onDone }: { projectId: string; parents: Element[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("subsystem");
  const [parentId, setParentId] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={14} /> Elemento</Button>;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
      <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
        {Object.entries(SYS_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      <Select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full">
        <option value="">(raiz)</option>
        {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !name} onClick={() => start(async () => { await createSystemElement({ projectId, name, kind, parentId: parentId || null }); setOpen(false); setName(""); onDone(); })}>Salvar</Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

function AddInterfaceButton({ projectId, elements, onDone }: { projectId: string; elements: Element[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fromId, setFromId] = useState(elements[0]?.id ?? "");
  const [toId, setToId] = useState(elements[1]?.id ?? elements[0]?.id ?? "");
  const [kind, setKind] = useState("data");
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}><Plus size={14} /> Interface</Button>;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da interface" />
      <div className="grid grid-cols-2 gap-2">
        <Select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full">{elements.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        <Select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full">{elements.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
      </div>
      <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">{Object.entries(IFACE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      <Button size="sm" disabled={pending || !name || fromId === toId} onClick={() => start(async () => { await createInterface({ projectId, fromId, toId, name, kind }); setOpen(false); setName(""); onDone(); })}>Criar interface</Button>
    </div>
  );
}
