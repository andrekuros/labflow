"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Search, Sparkles, FilePlus } from "lucide-react";
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
  isAdmin,
  nextcloud,
  folderTree,
  healthReport,
}: {
  articles: ArticleItem[];
  projects: { id: string; key: string; name: string }[];
  isAdmin?: boolean;
  nextcloud?: NextcloudInfo;
  folderTree: { nextcloud: FolderTreeNode[]; localCount: number; totalCount: number };
  healthReport?: HealthReport | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [open, setOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>("all");

  const filtered = useMemo(() => {
    return articles.filter((a) =>
      articleMatchesFolder(
        { externalFolder: a.externalFolder ?? null, externalSource: a.externalSource ?? null },
        selectedFolder,
      ),
    );
  }, [articles, selectedFolder]);

  function runSearch() {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    startSearch(async () => setResults(await searchKnowledge(query)));
  }

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
        {isAdmin && nextcloud?.enabled && (
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
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Busca semantica no conhecimento do laboratorio..."
            className="h-10 pl-8"
          />
        </div>
        <Button variant="outline" onClick={runSearch} disabled={searching}>
          <Sparkles size={15} /> {searching ? "Buscando..." : "Buscar"}
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Novo artigo
        </Button>
      </div>

      {syncMsg && <p className="mb-4 text-xs text-muted">{syncMsg}</p>}
      {isAdmin && nextcloud?.enabled && <KnowledgeHealthPanel initial={healthReport ?? null} />}

      {results && (
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.title}</p>
                  <span className="text-[11px] text-muted">{Math.round(r.score * 100)}% relevante</span>
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
            onSelect={setSelectedFolder}
          />
        )}

        <div>
          {selectedFolder && selectedFolder !== "all" && (
            <p className="mb-3 text-xs text-muted">
              Filtrando: <span className="font-mono">{selectedFolder === "_local" ? "artigos locais" : selectedFolder}</span>
              {" · "}
              {filtered.length} artigo(s)
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <Link key={a.id} href={`/knowledge/${a.id}`}>
                <Card className="h-full p-4 transition hover:border-brand/60">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {a.projectKey && <Badge color={a.projectColor ?? "#6366f1"}>{a.projectKey}</Badge>}
                    {a.externalSource === "nextcloud" && <Badge className="bg-surface2 text-muted">Nextcloud</Badge>}
                    {a.externalStatus && (
                      <Badge className="bg-surface2 text-muted">{STATUS_LABELS[a.externalStatus] ?? a.externalStatus}</Badge>
                    )}
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
        </div>
      </div>

      {open && (
        <NewArticleModal
          projects={projects}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}

      {templateOpen && isAdmin && (
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
