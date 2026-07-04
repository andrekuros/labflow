"use client";

import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { ClipboardList, PackageCheck, Target } from "lucide-react";
import type { ArticleBacklink } from "@/plugins/knowledge/link-actions";

const TYPE_LABELS: Record<string, { label: string; icon: typeof ClipboardList }> = {
  task: { label: "Tarefas", icon: ClipboardList },
  deliverable: { label: "Entregaveis", icon: PackageCheck },
  requirement: { label: "Requisitos", icon: Target },
};

export function ArticleBacklinks({ backlinks }: { backlinks: ArticleBacklink[] }) {
  if (backlinks.length === 0) {
    return (
      <Card className="mt-6 p-4">
        <h3 className="text-sm font-semibold">Vinculado a</h3>
        <p className="mt-2 text-sm text-muted">Nenhum vinculo com artefatos do projeto.</p>
      </Card>
    );
  }

  const grouped = new Map<string, ArticleBacklink[]>();
  for (const b of backlinks) {
    const list = grouped.get(b.targetType) ?? [];
    list.push(b);
    grouped.set(b.targetType, list);
  }

  return (
    <Card className="mt-6 p-4">
      <h3 className="mb-3 text-sm font-semibold">Vinculado a</h3>
      <div className="space-y-4">
        {["task", "deliverable", "requirement"].map((type) => {
          const items = grouped.get(type);
          if (!items?.length) return null;
          const meta = TYPE_LABELS[type];
          const Icon = meta.icon;
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                <Icon size={14} />
                {meta.label}
              </div>
              <div className="space-y-2">
                {items.map((b) => (
                  <Link
                    key={b.id}
                    href={b.href}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface2"
                  >
                    <Badge color={b.projectColor}>{b.projectKey}</Badge>
                    <span className="truncate">{b.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
