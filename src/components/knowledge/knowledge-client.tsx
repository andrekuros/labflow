"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Search, FilePlus, Cloud, Upload, FolderSync, FolderPlus } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label, Badge } from "@/components/ui";
import {
  createArticle,
  searchKnowledge,
  syncNextcloudAction,
  createNextcloudTemplateAction,
  uploadLibraryFileAction,
  migrateLocalArticlesToVaultAction,
  ensureMissingProjectVaultsAction,
} from "@/plugins/knowledge/actions";
import { TEMPLATE_CATALOG, type TemplateKey } from "@/plugins/knowledge/templates-catalog";
import { articleMatchesFolder } from "@/plugins/knowledge/folder-tree";
import type { FolderTreeNode } from "@/plugins/knowledge/folder-tree";
import type { KnowledgeSearchResult } from "@/plugins/knowledge/types";
import { KnowledgeFolderTree } from "@/components/knowledge/knowledge-folder-tree";
import { AdminOnlyBadge } from "@/components/knowledge/admin-only-badge";
import { KnowledgeHealthPanel } from "@/components/knowledge/knowledge-health-panel";
import { KindIcon, LibraryPreview } from "@/components/knowledge/library-preview";
import { vaultWriteFolder } from "@/lib/knowledge/vault-layout";
import { LIBRARY_ACCEPT } from "@/lib/knowledge/files";
import type { HealthReport } from "@/plugins/knowledge/health";

type ArticleItem = {
  id: string;
  title: string;
  tags: string;
  updatedAt: string;
  projectKey: string | null;
  projectColor: string | null;
  author: string;
  kind?: string;
  fileName?: string | null;
  externalSource?: string | null;
  externalFolder?: string | null;
  externalStatus?: string | null;
  adminOnly?: boolean;
};

type ProjectItem = { id: string; key: string; name: string; kind: string };

type NextcloudInfo = {
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncMessage: string | null;
  lastSyncStatus: string | null;
} | null;

export function KnowledgeClient({
  articles,
  projects,
  canCreate,
  canManage,
  semanticSearchEnabled,
  nextcloud,
  folderTree,
  healthReport,
  initialFolder,
  initialDoc,
  adminOnlyFolders = [],
}: {
  articles: ArticleItem[];
  projects: ProjectItem[];
  canCreate: boolean;
  canManage: boolean;
  semanticSearchEnabled: boolean;
  nextcloud?: NextcloudInfo;
  folderTree: { nextcloud: FolderTreeNode[]; localCount: number; totalCount: number };
  healthReport?: HealthReport | null;
  initialFolder: string;
  initialDoc: string | null;
  adminOnlyFolders?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(initialDoc);

  function navigate(folder: string | null, doc: string | null) {
    setSelectedFolder(folder);
    setSelectedDoc(doc);
    const sp = new URLSearchParams(searchParams.toString());
    if (folder && folder !== "all") sp.set("folder", folder);
    else sp.delete("folder");
    if (doc) sp.set("doc", doc);
    else sp.delete("doc");
    router.replace(`/knowledge?${sp.toString()}`);
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
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.tags.toLowerCase().includes(q);
    });
  }, [articles, selectedFolder, textFilter]);

  const targetFolder =
    selectedFolder && selectedFolder !== "all" && selectedFolder !== "_local" ? selectedFolder : "geral";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {nextcloud?.enabled && (
          <span className="text-xs text-muted">
            Vault Nextcloud
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
              {syncing ? "Sincronizando..." : "Sync vault"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              <FilePlus size={14} /> Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={() =>
                startSync(async () => {
                  const r = await migrateLocalArticlesToVaultAction();
                  setSyncMsg(r.message);
                  router.refresh();
                })
              }
            >
              <FolderSync size={14} /> Enviar locais ao vault
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={() =>
                startSync(async () => {
                  const r = await ensureMissingProjectVaultsAction();
                  setSyncMsg(r.message);
                  router.refresh();
                })
              }
            >
              <FolderPlus size={14} /> Criar pastas dos projetos
            </Button>
          </>
        )}
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={semanticSearchEnabled
              ? "Busca semantica na biblioteca..."
              : "Buscar por titulo, conteudo ou tags..."}
            className="h-10 pl-8"
          />
        </div>
        {searching && <span className="text-xs text-muted">Buscando...</span>}
        {canCreate && nextcloud?.enabled && (
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload size={16} /> Enviar arquivo
          </Button>
        )}
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Nova pagina
          </Button>
        )}
      </div>

      {syncMsg && <p className="mb-3 text-xs text-muted">{syncMsg}</p>}
      {canManage && nextcloud?.enabled && <KnowledgeHealthPanel initial={healthReport ?? null} />}

      {results && query.trim() && (
        <Card className="mb-4 p-4">
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
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(selectedFolder, r.id)}
                className="block w-full rounded-lg border border-border p-3 text-left hover:bg-surface2"
              >
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
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_260px_1fr]">
        <KnowledgeFolderTree
          tree={folderTree.nextcloud}
          localCount={folderTree.localCount}
          selected={selectedFolder}
          onSelect={(folder) => navigate(folder, null)}
          adminOnlyFolders={adminOnlyFolders}
        />

        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-2">
            <Input
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Filtrar nesta pasta..."
              className="h-8 text-xs"
            />
            <p className="mt-1 px-1 text-[11px] text-muted">
              {filtered.length} documento(s)
              {selectedFolder && selectedFolder !== "all"
                ? ` · ${selectedFolder === "_local" ? "locais" : selectedFolder}`
                : ""}
            </p>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-1">
            {filtered.map((a) => {
              const active = selectedDoc === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(selectedFolder, a.id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface2 ${active ? "bg-surface2 font-medium text-brand" : ""}`}
                >
                  <KindIcon kind={a.kind ?? "page"} fileName={a.fileName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{a.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      {a.projectKey && <Badge color={a.projectColor ?? "#6366f1"}>{a.projectKey}</Badge>}
                      {a.externalSource === "nextcloud" && (
                        <Cloud size={11} className="text-muted" />
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="p-3 text-xs text-muted">Nenhum documento nesta pasta.</p>}
          </div>
        </div>

        <Card className="min-h-[420px] overflow-hidden p-0">
          {selectedDoc ? (
            <LibraryPreview articleId={selectedDoc} />
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-6 text-center text-muted">
              <p className="text-sm">Selecione um documento na lista.</p>
              <p className="mt-1 text-xs">Pastas do vault sao os livros da biblioteca. PDF, DOCX, Excel e PowerPoint entram no indice da IA.</p>
            </div>
          )}
        </Card>
      </div>

      {open && canCreate && (
        <NewArticleModal
          projects={projects}
          folder={targetFolder}
          vaultEnabled={Boolean(nextcloud?.enabled)}
          onClose={() => setOpen(false)}
          onSaved={(id) => {
            setOpen(false);
            navigate(selectedFolder, id);
            router.refresh();
          }}
        />
      )}

      {uploadOpen && canCreate && (
        <UploadModal
          projects={projects}
          folder={targetFolder}
          onClose={() => setUploadOpen(false)}
          onSaved={(id) => {
            setUploadOpen(false);
            navigate(selectedFolder, id);
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

function vaultDestination(projects: ProjectItem[], projectId: string, fallbackFolder: string): string {
  const p = projects.find((x) => x.id === projectId);
  if (p) return vaultWriteFolder(p.kind, p.key);
  return fallbackFolder;
}

function NewArticleModal({
  projects,
  folder,
  vaultEnabled,
  onClose,
  onSaved,
}: {
  projects: ProjectItem[];
  folder: string;
  vaultEnabled: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pending, start] = useTransition();
  const dest = vaultDestination(projects, projectId, folder);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nova pagina</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2">
            <X size={18} />
          </button>
        </div>
        {vaultEnabled && (
          <p className="mb-3 text-xs text-muted">Sera gravada no vault em <span className="font-mono">{dest}</span>.</p>
        )}
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
                  const a = await createArticle({
                    title,
                    content,
                    tags,
                    projectId: projectId || null,
                    folder,
                  });
                  onSaved(a.id);
                })
              }
            >
              {vaultEnabled ? "Salvar no vault" : "Publicar"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function UploadModal({
  projects,
  folder,
  onClose,
  onSaved,
}: {
  projects: ProjectItem[];
  folder: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dest = vaultDestination(projects, projectId, folder);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Enviar arquivo ao vault</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted">PDF, DOCX, Excel, PowerPoint, Markdown ou TXT. Destino: <span className="font-mono">{dest}</span></p>
        <div className="space-y-3">
          <input
            type="file"
            accept={LIBRARY_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <div>
            <Label>Projeto (opcional)</Label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
              <option value="">(pasta selecionada)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} - {p.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={pending || !file}
              onClick={() =>
                start(async () => {
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("file", file);
                  fd.set("folder", folder);
                  if (projectId) fd.set("projectId", projectId);
                  const r = await uploadLibraryFileAction(fd);
                  if ("error" in r) setError(r.error);
                  else onSaved(r.id);
                })
              }
            >
              {pending ? "Enviando..." : "Enviar"}
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
