export type SysNode = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
};

export type IfaceEdge = {
  id: string;
  name: string;
  fromName: string;
  toName: string;
  kind: string;
};

function safeId(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40) || "node";
}

export function buildContextDiagram(systemName: string, externals: SysNode[], interfaces: IfaceEdge[]): string {
  const lines = ["graph LR"];
  lines.push(`  SOI["${systemName}"]`);
  for (const ext of externals) {
    const id = safeId(ext.name);
    lines.push(`  ${id}["${ext.name}"]`);
    const linked = interfaces.some((i) => i.fromName === ext.name || i.toName === ext.name);
    if (linked) lines.push(`  ${id} --> SOI`);
  }
  return lines.join("\n");
}

export function buildBddDiagram(nodes: SysNode[]): string {
  const lines = ["graph TD"];
  const children = new Map<string, SysNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = children.get(n.parentId) ?? [];
    list.push(n);
    children.set(n.parentId, list);
  }
  for (const n of nodes) {
    const id = safeId(n.id);
    lines.push(`  ${id}["${n.name}"]`);
    for (const c of children.get(n.id) ?? []) {
      lines.push(`  ${id} --> ${safeId(c.id)}`);
    }
  }
  return lines.join("\n");
}
