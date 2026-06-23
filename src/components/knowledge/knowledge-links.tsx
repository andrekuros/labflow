"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, Link2, Plus, X } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import {
  getKnowledgeLinksAction,
  searchArticlesForLinkAction,
  linkArticleAction,
  unlinkArticleAction,
  type LinkTargetType,
} from "@/plugins/knowledge/link-actions";

export function KnowledgeLinksPanel({
  targetType,
  targetId,
  projectId,
  canEdit,
  compact,
}: {
  targetType: LinkTargetType;
  targetId: string;
  projectId: string;
  canEdit: boolean;
  compact?: boolean;
}) {
  const [links, setLinks] = useState<{ id: string; articleId: string; title: string; externalSource: string | null }[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; externalSource: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function refresh() {
    start(async () => setLinks(await getKnowledgeLinksAction(targetType, targetId)));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  function search() {
    start(async () => setResults(await searchArticlesForLinkAction(projectId, query)));
  }

  return (
    <div className={compact ? "" : "mt-4 rounded-lg border border-border bg-surface2/30 p-3"}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Link2 size={13} /> Documentacao
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs text-brand hover:underline"
          >
            {open ? "Fechar" : "+ Vincular"}
          </button>
        )}
      </div>

      {links.length === 0 && !open && (
        <p className="text-xs text-muted">Nenhum artigo vinculado.</p>
      )}

      <div className="space-y-1">
        {links.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-surface2">
            <Link href={`/knowledge/${l.articleId}`} className="flex min-w-0 items-center gap-1.5 text-xs hover:text-brand">
              <BookOpen size={12} className="shrink-0 text-muted" />
              <span className="truncate">{l.title}</span>
              {l.externalSource === "nextcloud" && (
                <Badge className="bg-surface2 text-[10px] text-muted">NC</Badge>
              )}
            </Link>
            {canEdit && (
              <button
                type="button"
                onClick={() => start(async () => { await unlinkArticleAction(l.id); refresh(); })}
                className="shrink-0 rounded p-0.5 text-muted hover:text-red-400"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {open && canEdit && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Buscar artigo..."
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" disabled={pending} onClick={search}>
              <Plus size={14} />
            </Button>
          </div>
          {results.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={pending || links.some((l) => l.articleId === a.id)}
              onClick={() =>
                start(async () => {
                  await linkArticleAction({ articleId: a.id, targetType, targetId });
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                  refresh();
                })
              }
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface2 disabled:opacity-50"
            >
              {a.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
