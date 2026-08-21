"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, FileIcon, Link2, Plus, Download, X } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { LIBRARY_ACCEPT } from "@/lib/knowledge/files";
import {
  getKnowledgeLinksAction,
  searchArticlesForLinkAction,
  linkArticleAction,
  unlinkArticleAction,
  attachFileToEntityAction,
  type LinkTargetType,
  type KnowledgeLinkItem,
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [links, setLinks] = useState<KnowledgeLinkItem[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; externalSource: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function afterChange() {
    refresh();
    router.refresh();
  }

  function onFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("targetType", targetType);
    fd.set("targetId", targetId);
    start(async () => {
      const r = await attachFileToEntityAction(fd);
      if (fileRef.current) fileRef.current.value = "";
      if ("error" in r) {
        setError(r.error);
        return;
      }
      afterChange();
    });
  }

  return (
    <div className={compact ? "" : "mt-4 rounded-lg border border-border bg-surface2/30 p-3"}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Link2 size={13} /> Arquivos e docs
        </p>
        {canEdit && (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={LIBRARY_ACCEPT}
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="text-xs text-brand hover:underline disabled:opacity-50"
            >
              Enviar arquivo
            </button>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="text-xs text-brand hover:underline"
            >
              {open ? "Fechar" : "+ Vincular"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {links.length === 0 && !open && (
        <p className="text-xs text-muted">Nenhum arquivo ou artigo vinculado.</p>
      )}

      <div className="space-y-1">
        {links.map((l) => {
          const isFile = l.kind === "file";
          const Icon = isFile ? FileIcon : BookOpen;
          return (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-surface2">
              <Link href={`/knowledge/${l.articleId}`} className="flex min-w-0 items-center gap-1.5 text-xs hover:text-brand">
                <Icon size={12} className="shrink-0 text-muted" />
                <span className="truncate">{l.title}</span>
                {isFile && l.fileName && (
                  <Badge className="bg-surface2 text-[10px] text-muted">{l.fileName.split(".").pop()?.toUpperCase()}</Badge>
                )}
                {l.externalSource === "nextcloud" && (
                  <Badge className="bg-surface2 text-[10px] text-muted">NC</Badge>
                )}
              </Link>
              <div className="flex shrink-0 items-center gap-0.5">
                {isFile && (
                  <a
                    href={`/api/knowledge/file/${l.articleId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-0.5 text-muted hover:text-brand"
                    title="Baixar"
                  >
                    <Download size={12} />
                  </a>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => start(async () => { await unlinkArticleAction(l.id); afterChange(); })}
                    className="rounded p-0.5 text-muted hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
                  afterChange();
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
