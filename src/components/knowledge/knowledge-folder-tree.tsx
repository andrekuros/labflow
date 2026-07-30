"use client";

import { Folder, FolderOpen, FileText, Shield } from "lucide-react";
import { isPathUnderFolders } from "@/plugins/knowledge/folder-path";
import type { FolderTreeNode } from "@/plugins/knowledge/folder-tree";

type Props = {
  tree: FolderTreeNode[];
  localCount: number;
  selected: string | null;
  onSelect: (path: string | null) => void;
  adminOnlyFolders?: string[];
};

function TreeNode({
  node,
  selected,
  onSelect,
  adminOnlyFolders,
  depth = 0,
}: {
  node: FolderTreeNode;
  selected: string | null;
  onSelect: (path: string | null) => void;
  adminOnlyFolders: string[];
  depth?: number;
}) {
  const isSelected = selected === node.path;
  const Icon = isSelected ? FolderOpen : Folder;
  const isAdminFolder = node.path !== "" && isPathUnderFolders(node.path, adminOnlyFolders);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2 ${isSelected ? "bg-surface2 font-medium text-brand" : "text-fg"}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <Icon size={14} className={`shrink-0 ${isAdminFolder ? "text-red-400" : "text-muted"}`} />
        <span className="truncate flex-1">{node.name}</span>
        {isAdminFolder && (
          <span title="Somente administradores">
            <Shield size={12} className="shrink-0 text-red-400" />
          </span>
        )}
        <span className="text-[11px] text-muted">{node.totalCount}</span>
      </button>
      {node.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          selected={selected}
          onSelect={onSelect}
          adminOnlyFolders={adminOnlyFolders}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function KnowledgeFolderTree({ tree, localCount, selected, onSelect, adminOnlyFolders = [] }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Pastas</p>
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={`mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2 ${selected === "all" || selected === null ? "bg-surface2 font-medium" : ""}`}
      >
        <Folder size={14} className="text-muted" />
        <span className="flex-1">Todas</span>
      </button>
      {tree.map((node) => (
        <TreeNode
          key={node.path || node.name}
          node={node}
          selected={selected}
          onSelect={onSelect}
          adminOnlyFolders={adminOnlyFolders}
        />
      ))}
      {localCount > 0 && (
        <button
          type="button"
          onClick={() => onSelect("_local")}
          className={`mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2 ${selected === "_local" ? "bg-surface2 font-medium" : ""}`}
        >
          <FileText size={14} className="text-muted" />
          <span className="flex-1">Artigos locais</span>
          <span className="text-[11px] text-muted">{localCount}</span>
        </button>
      )}
    </div>
  );
}
