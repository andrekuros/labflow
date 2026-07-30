"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Search, Sparkles, FilePlus, Cloud, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label, Badge } from "@/components/ui";
import {
  createArticle,
  searchKnowledge,
  syncNextcloudAction,
  createNextcloudTemplateAction,
} from "@/plugins/knowledge/actions";
import { TEMPLATE_CATALOG, type TemplateKey } from "@/plugins/knowledge/templates-catalog";
import { articleMatchesFolder } from "@/plugins/knowledge/folder-tree";
import type { FolderTreeNode } from "@/plugins/knowledge/folder-tree";
import type { KnowledgeSearchResult } from "@/plugins/knowledge/types";
import { KnowledgeFolderTree } from "@/components/knowledge/knowledge-folder-tree";
import { AdminOnlyBadge } from "@/components/knowledge/admin-only-badge";
import { KnowledgeHealthPanel } from "@/components/knowledge/knowledge-health-panel";
import type { HealthReport } from "@/plugins/knowledge/health";

type ArticleItem = {
  id: string;
  title: string;
  tags: string;
  updatedAt: string;
  projectKey: string | null;
  projectColor: string | null;
  author: string;
  externalSource?: string | null;
  externalFolder?: string | null;
  externalStatus?: string | null;
  adminOnly?: boolean;
};

type NextcloudInfo = {
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncMessage: string | null;
  lastSyncStatus: string | null;
} | null;

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

export function KnowledgeClient({
  articles,
  projects,
  canCreate,
  canManage,
  semanticSearchEnabled,
  nextcloud,
  folderTree,
  healthReport,
  pagination,
  initialFolder,
  adminOnlyFolders = [],
}: {
  articles: ArticleItem[];
  projects: { id: string; key: string; name: string }[];
  canCreate: boolean;
  canManage: boolean;
  semanticSearchEnabled: boolean;
  nextcloud?: NextcloudInfo;
  folderTree: { nextcloud: FolderTreeNode[]; localCount: number; totalCount: number };
  healthReport?: HealthReport | null;
  pagination: { page: number; totalPages: number; totalCount: number; pageSize: number };
  initialFolder: string;
  adminOnlyFolders?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [open, setOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder);

  function navigateFolder(folder: string | null) {
    setSelectedFolder(folder);
    const sp = new URLSearchParams(searchParams.toString());
    if (folder && folder !== "all") sp.set("folder", folder);
    else sp.delete("folder");
    sp.delete("page");
    router.push(`/knowledge?${sp.toString()}`);
  }

  function navigatePage(page: number) {
    const sp = new URLSearchParams(searchParams.toString());
    if (page > 1) sp.set("page", String(page));
    else sp.delete("page");
    router.push(`/knowledge?${sp.toString()}`);
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      startSearch(async () => setResults(await searchKnowledge(query)));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const q = textFilter.trim().toLowerCase();
    return articles.filter((a) => {
      if (!articleMatchesFolder(
        { externalFolder: a.externalFolder ?? null, externalSource: a.externalSource ?? null },
        selectedFolder,
      )) return false;
      if (statusFilter && a.externalStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.toLowerCase().includes(q)
      );
    });
  }, [articles, selectedFolder, textFilter, statusFilter]);

  const targetFolder =
    selectedFolder && selectedFolder !== "all" && selectedFolder !== "_local" ? selectedFolder : "geral";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {nextcloud?.enabled && (
          <span className="text-xs text-muted">
            Nextcloud
            {nextcloud.lastSyncAt
              ? ` · sync ${new Date(nextcloud.lastSyncAt).toLocaleString("pt-BR")}`
              : " · aguardando primeiro sync"}
          </span>
        )}
        {canManage && nextcloud?.enabled && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={() =>
                startSync(async () => {
                  const r = await syncNextcloudAction();
                  setSyncMsg(r.message);
                  router.refresh();
                })
              }
            >
              {syncing ? "Sincronizando..." : "Sync Nextcloud"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              <FilePlus size={14} /> Novo template
            </Button>
          </>
        )}
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={semanticSearchEnabled
              ? "Busca semantica no conhecimento..."
              : "Buscar por titulo, conteudo ou tags..."}
            className="h-10 pl-8"
          />
        </div>
        {searching && (
          <span className="text-xs text-muted">Buscando...</span>
        )}
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Novo artigo
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
          placeholder="Filtrar por titulo ou tag..."
          className="h-9 max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9">
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="active">Ativo</option>
          <option value="archived">Arquivado</option>
        </Select>
        <span className="text-xs text-muted">
          {pagination.totalCount} artigo(s) no total
        </span>
      </div>

      {syncMsg && <p className="mb-4 text-xs text-muted">{syncMsg}</p>}
      {canManage && nextcloud?.enabled && <KnowledgeHealthPanel initial={healthReport ?? null} />}

      {results && query.trim() && (
        <Card className="mb-5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Resultados ({results.articles.length})</h3>
            <button
              onClick={() => {
                setResults(null);
                setQuery("");
              }}
              className="text-xs text-muted hover:text-fg"
            >
              limpar
            </button>
          </div>
          {results.articles.length === 0 && <p className="text-sm text-muted">Nada encontrado.</p>}
          <div className="space-y-2">
            {results.articles.map((r) => (
              <Link key={r.id} href={`/knowledge/${r.id}`} className="block rounded-lg border border-border p-3 hover:bg-surface2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.adminOnly && <AdminOnlyBadge />}
                  </div>
                  {semanticSearchEnabled && (
                    <span className="text-[11px] text-muted">{Math.round(r.score * 100)}% relevante</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{r.snippet}</p>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {nextcloud?.enabled && (
          <KnowledgeFolderTree
            tree={folderTree.nextcloud}
            localCount={folderTree.localCount}
            selected={selectedFolder}
            onSelect={navigateFolder}
            adminOnlyFolders={adminOnlyFolders}
          />
        )}

        <div>
          {selectedFolder && selectedFolder !== "all" && (
            <p className="mb-3 text-xs text-muted">
              Filtrando: <span className="font-mono">{selectedFolder === "_local" ? "artigos locais" : selectedFolder}</span>
              {" · "}
              {filtered.length} artigo(s) nesta pagina
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <Link key={a.id} href={`/knowledge/${a.id}`}>
                <Card className="h-full p-4 transition hover:border-brand/60">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {a.projectKey && <Badge color={a.projectColor ?? "#6366f1"}>{a.projectKey}</Badge>}
                    {a.externalSource === "nextcloud" && (
                      <span title="Somente leitura — edite no Nextcloud">
                        <Badge className="bg-surface2 text-muted">
                          <Cloud size={12} className="mr-1 inline" /> Nextcloud
                        </Badge>
                      </span>
                    )}
                    {a.externalStatus && (
                      <Badge className="bg-surface2 text-muted">{STATUS_LABELS[a.externalStatus] ?? a.externalStatus}</Badge>
                    )}
                    {a.adminOnly && <AdminOnlyBadge />}
                  </div>
                  <h3 className="font-medium">{a.title}</h3>
                  {a.externalFolder && (
                    <p className="mt-1 truncate font-mono text-[11px] text-muted">{a.externalFolder}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.tags
                      .split(",")
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((t) => (
                        <Badge key={t} className="bg-surface2 text-muted">
                          {t.trim()}
                        </Badge>
                      ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">{a.author}</p>
                </Card>
              </Link>
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted">Nenhum artigo nesta pasta.</p>}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => navigatePage(pagination.page - 1)}
              >
                <ChevronLeft size={14} /> Anterior
              </Button>
              <span className="text-sm text-muted">
                Pagina {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => navigatePage(pagination.page + 1)}
              >
                Proxima <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {open && canCreate && (
        <NewArticleModal
          projects={projects}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}

      {templateOpen && canManage && (
        <TemplateModal
          targetFolder={targetFolder}
          onClose={() => setTemplateOpen(false)}
          onCreated={() => {
            setTemplateOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewArticleModal({
  projects,
  onClose,
  onSaved,
}: {
  projects: { id: string; key: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Novo artigo de conhecimento</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Titulo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Conteudo</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Notas, decisoes, protocolos..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="eeg, protocolo" />
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
                <option value="">(geral)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} - {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !title}
              onClick={() =>
                start(async () => {
                  await createArticle({ title, content, tags, projectId: projectId || null });
                  onSaved();
                })
              }
            >
              Publicar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TemplateModal({
  targetFolder,
  onClose,
  onCreated,
}: {
  targetFolder: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("protocolo");
  const [folder, setFolder] = useState(targetFolder);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Criar template no Nextcloud</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Template</Label>
            <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value as TemplateKey)} className="w-full">
              {(Object.keys(TEMPLATE_CATALOG) as TemplateKey[]).map((k) => (
                <option key={k} value={k}>
                  {TEMPLATE_CATALOG[k].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Pasta de destino</Label>
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="protocolos" />
          </div>
          <div>
            <Label>Titulo do documento</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do protocolo" />
          </div>
          {msg && <p className="text-xs text-muted">{msg}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createNextcloudTemplateAction({ templateKey, targetFolder: folder, title });
                  setMsg(r.message);
                  if (r.ok) onCreated();
                })
              }
            >
              {pending ? "Criando..." : "Criar no Nextcloud"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
