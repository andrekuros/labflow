"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card, Badge, PageHeader, Select } from "@/components/ui";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  FolderTree,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type {
  RepositoryCollectionNode,
  RepositoryRecordRow,
  RepositorySearchFacets,
  RepositorySearchQuery,
  RepositorySearchResult,
  RepositorySort,
} from "@/lib/repository/search-types";
import { RECORD_STATUS_COLORS, RECORD_STATUS_LABELS, isRecordStatus } from "@/lib/repository/vocab";
import { searchRecordsAction, reindexRepositoryAction } from "@/plugins/repository/actions";
import { formatBytes } from "@/lib/repository/format";
import { RepositoryAskPanel } from "@/components/repository/repository-ask-panel";
import { RecordFormDialog, type RecordFormOptions } from "@/components/repository/record-form";
import { CollectionManager } from "@/components/repository/collection-manager";

const SORT_LABELS: Record<RepositorySort, string> = {
  relevance: "Mais relevantes",
  recent: "Mais recentes",
  oldest: "Mais antigos",
  title: "Titulo (A-Z)",
  year: "Ano (desc)",
  downloads: "Mais baixados",
};

type MultiKey = "resourceType" | "status" | "tag" | "subject" | "language" | "license";

const FACET_PANELS: { key: keyof RepositorySearchFacets; label: string; multi?: MultiKey }[] = [
  { key: "resourceType", label: "Tipo de recurso", multi: "resourceType" },
  { key: "status", label: "Situacao", multi: "status" },
  { key: "year", label: "Ano" },
  { key: "subject", label: "Assuntos", multi: "subject" },
  { key: "tag", label: "Tags", multi: "tag" },
  { key: "project", label: "Projeto" },
  { key: "language", label: "Idioma", multi: "language" },
  { key: "license", label: "Licenca", multi: "license" },
];

export function RepositoryBrowser({
  initial,
  initialQuery,
  collections,
  formOptions,
  canCreate,
  canManage,
  canAskAi,
  stats,
}: {
  initial: RepositorySearchResult;
  initialQuery?: RepositorySearchQuery;
  collections: RepositoryCollectionNode[];
  formOptions: RecordFormOptions;
  canCreate: boolean;
  canManage: boolean;
  canAskAi: boolean;
  stats: { records: number; files: number; totalBytes: number; collections: number };
}) {
  const [query, setQuery] = useState<RepositorySearchQuery>(
    initialQuery ?? { page: 1, sort: "recent" },
  );
  const [term, setTerm] = useState(initialQuery?.q ?? "");
  const [result, setResult] = useState(initial);
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [message, setMessage] = useState("");

  // Refetch whenever a filter changes. The first render already has server data.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    start(async () => {
      const r = await searchRecordsAction(query);
      if (r.ok) setResult(r.data);
      else setMessage(r.error);
    });
  }, [query, dirty]);

  function patch(next: Partial<RepositorySearchQuery>) {
    setDirty(true);
    setQuery((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));
  }

  function toggleMulti(key: MultiKey, value: string) {
    setDirty(true);
    setQuery((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next.length ? next : undefined, page: 1 };
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    patch({ q: term.trim() || undefined });
  }

  function clearAll() {
    setTerm("");
    setDirty(true);
    setQuery({ page: 1, sort: "recent" });
  }

  const activeFilters = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (query.q) chips.push({ label: `"${query.q}"`, clear: () => { setTerm(""); patch({ q: undefined }); } });
    if (query.collectionId) {
      const name = findCollection(collections, query.collectionId)?.name ?? "colecao";
      chips.push({ label: name, clear: () => patch({ collectionId: undefined }) });
    }
    for (const key of ["resourceType", "status", "tag", "subject", "language", "license"] as MultiKey[]) {
      for (const v of query[key] ?? []) {
        chips.push({ label: v, clear: () => toggleMulti(key, v) });
      }
    }
    if (query.projectId) {
      const p = formOptions.projects.find((x) => x.id === query.projectId);
      chips.push({ label: p ? p.key : "projeto", clear: () => patch({ projectId: undefined }) });
    }
    if (query.yearFrom || query.yearTo) {
      chips.push({
        label: `${query.yearFrom ?? "…"}–${query.yearTo ?? "…"}`,
        clear: () => patch({ yearFrom: undefined, yearTo: undefined }),
      });
    }
    return chips;
  }, [query, collections, formOptions.projects]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <PageHeader
        title="Repositorio"
        description="Acervo institucional de documentos: colecoes, metadados citaveis, arquivos e busca facetada."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canAskAi && (
              <button
                type="button"
                onClick={() => setAskOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  askOpen ? "bg-brand text-white" : "border border-border text-muted hover:bg-surface2 hover:text-fg"
                }`}
              >
                <Sparkles size={14} /> Perguntar ao acervo
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setShowCollections(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface2 hover:text-fg"
              >
                <Settings2 size={14} /> Colecoes
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                <Plus size={14} /> Novo deposito
              </button>
            )}
          </div>
        }
      />

      {message && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="text-muted hover:text-fg">
            <X size={13} />
          </button>
        </div>
      )}

      {askOpen && canAskAi && (
        <div className="mb-5">
          <RepositoryAskPanel
            recordIds={result.records.map((r) => r.id)}
            totalInScope={result.total}
            resultCount={result.records.length}
            hasFilters={activeFilters.length > 0}
          />
        </div>
      )}

      <form onSubmit={submitSearch} className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por titulo, autor, resumo, DOI, handle ou conteudo do arquivo"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
        </button>
        <Select
          value={query.sort ?? "recent"}
          onChange={(e) => patch({ sort: e.target.value as RepositorySort })}
          className="h-9 w-auto text-sm"
        >
          {(Object.keys(SORT_LABELS) as RepositorySort[])
            .filter((s) => s !== "relevance")
            .map((s) => (
              <option key={s} value={s}>{SORT_LABELS[s]}</option>
            ))}
        </Select>
      </form>

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Filtros:</span>
          {activeFilters.map((chip, i) => (
            <button
              key={`${chip.label}-${i}`}
              type="button"
              onClick={chip.clear}
              className="flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-brand transition hover:bg-brand/20"
            >
              {chip.label}
              <X size={11} />
            </button>
          ))}
          <button type="button" onClick={clearAll} className="ml-1 text-muted underline-offset-2 hover:underline">
            limpar tudo
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <Card className="p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <FolderTree size={13} /> Colecoes
            </div>
            <button
              type="button"
              onClick={() => patch({ collectionId: undefined })}
              className={`mb-1 flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition hover:bg-surface2 ${
                !query.collectionId ? "bg-surface2 font-medium" : ""
              }`}
            >
              <span>Todo o acervo</span>
              <span className="text-xs text-muted">{stats.records}</span>
            </button>
            {collections.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted">
                Nenhuma colecao criada{canManage ? " — use o botao Colecoes." : "."}
              </p>
            ) : (
              <CollectionTree
                nodes={collections}
                selectedId={query.collectionId ?? null}
                onSelect={(id) => patch({ collectionId: id })}
              />
            )}
          </Card>

          {FACET_PANELS.map((panel) => {
            const facets = result.facets[panel.key];
            if (!facets || facets.length === 0) return null;
            return (
              <FacetPanel
                key={panel.key}
                label={panel.label}
                facets={facets}
                selected={panel.multi ? query[panel.multi] ?? [] : yearSelection(panel.key, query)}
                onToggle={(value) => {
                  if (panel.multi) toggleMulti(panel.multi, value);
                  else if (panel.key === "year") {
                    const y = Number(value);
                    const already = query.yearFrom === y && query.yearTo === y;
                    patch({ yearFrom: already ? undefined : y, yearTo: already ? undefined : y });
                  } else if (panel.key === "project") {
                    patch({ projectId: query.projectId === value ? undefined : value });
                  }
                }}
              />
            );
          })}

          <Card className="p-3 text-xs text-muted">
            <p className="mb-1 font-medium text-fg">Acervo</p>
            <p>{stats.records} deposito(s) · {stats.collections} colecao(oes)</p>
            <p>{stats.files} arquivo(s) · {formatBytes(stats.totalBytes)}</p>
            {canManage && (
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    const r = await reindexRepositoryAction();
                    setMessage(
                      r.ok
                        ? `Reindexado: ${r.indexed} deposito(s), ${r.skipped} ignorado(s).`
                        : r.error,
                    );
                  })
                }
                disabled={pending}
                className="mt-2 flex items-center gap-1 text-brand underline-offset-2 hover:underline disabled:opacity-60"
              >
                <RefreshCw size={11} /> Reindexar busca semantica
              </button>
            )}
          </Card>
        </aside>

        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>
              {result.total} resultado(s)
              {result.total > result.pageSize && ` · pagina ${result.page} de ${totalPages}`}
            </span>
            {pending && <Loader2 size={13} className="animate-spin" />}
          </div>

          {result.records.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-medium">Nenhum deposito encontrado</p>
              <p className="mt-1 text-sm text-muted">
                {activeFilters.length > 0
                  ? "Ajuste ou limpe os filtros."
                  : canCreate
                    ? "Comece depositando um documento."
                    : "O acervo ainda esta vazio."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {result.records.map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button
                type="button"
                disabled={result.page <= 1 || pending}
                onClick={() => patch({ page: result.page - 1 })}
                className="rounded border border-border px-3 py-1 text-muted transition hover:bg-surface2 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-muted">
                {result.page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={result.page >= totalPages || pending}
                onClick={() => patch({ page: result.page + 1 })}
                className="rounded border border-border px-3 py-1 text-muted transition hover:bg-surface2 disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          )}
        </section>
      </div>

      {showForm && (
        <RecordFormDialog
          options={formOptions}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setDirty(true);
            setQuery((prev) => ({ ...prev, page: 1 }));
          }}
        />
      )}

      {showCollections && (
        <CollectionManager
          collections={collections}
          onClose={() => setShowCollections(false)}
        />
      )}
    </div>
  );
}

function yearSelection(key: keyof RepositorySearchFacets, query: RepositorySearchQuery): string[] {
  if (key === "year" && query.yearFrom && query.yearFrom === query.yearTo) {
    return [String(query.yearFrom)];
  }
  if (key === "project" && query.projectId) return [query.projectId];
  return [];
}

function findCollection(
  nodes: RepositoryCollectionNode[],
  id: string,
): RepositoryCollectionNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findCollection(n.children, id);
    if (found) return found;
  }
  return null;
}

function CollectionTree({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: RepositoryCollectionNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  return (
    <div>
      {nodes.map((node) => {
        const isOpen = !collapsed.has(node.id);
        return (
          <div key={node.id}>
            <div
              className={`flex items-center gap-0.5 rounded transition hover:bg-surface2 ${
                selectedId === node.id ? "bg-surface2" : ""
              }`}
              style={{ paddingLeft: depth * 10 }}
            >
              {node.children.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    })
                  }
                  className="shrink-0 rounded p-0.5 text-muted hover:text-fg"
                >
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span className="w-[17px] shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 pr-2 text-left text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: node.color }}
                  />
                  <span className={`truncate ${selectedId === node.id ? "font-medium" : ""}`}>
                    {node.name}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted">{node.totalRecordCount}</span>
              </button>
            </div>
            {isOpen && node.children.length > 0 && (
              <CollectionTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FacetPanel({
  label,
  facets,
  selected,
  onToggle,
}: {
  label: string;
  facets: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? facets : facets.slice(0, 6);
  return (
    <Card className="p-3">
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <div className="space-y-0.5">
        {visible.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onToggle(f.value)}
            className={`flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs transition hover:bg-surface2 ${
              selected.includes(f.value) ? "bg-brand/10 text-brand" : ""
            }`}
          >
            <span className="truncate">{f.label}</span>
            <span className="shrink-0 text-muted">{f.count}</span>
          </button>
        ))}
      </div>
      {facets.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 text-xs text-muted underline-offset-2 hover:underline"
        >
          {expanded ? "mostrar menos" : `mostrar todos (${facets.length})`}
        </button>
      )}
    </Card>
  );
}

function RecordCard({ record }: { record: RepositoryRecordRow }) {
  const statusColor = isRecordStatus(record.status)
    ? RECORD_STATUS_COLORS[record.status]
    : "#64748b";
  const statusLabel = isRecordStatus(record.status)
    ? RECORD_STATUS_LABELS[record.status]
    : record.status;

  return (
    <Card className="p-4 transition hover:border-brand/50">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className="bg-surface2 text-muted">{record.resourceTypeLabel}</Badge>
        {record.year && <span className="text-muted">{record.year}</span>}
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{ backgroundColor: `${statusColor}1f`, color: statusColor }}
        >
          {statusLabel}
        </span>
        {record.version > 1 && <Badge className="bg-surface2 text-muted">v{record.version}</Badge>}
        {record.collection && <Badge color={record.collection.color}>{record.collection.name}</Badge>}
        {record.project && <Badge color={record.project.color}>{record.project.key}</Badge>}
        <span className="ml-auto font-mono text-[11px] text-muted">{record.handle}</span>
      </div>

      <Link href={`/repository/${record.id}`} className="group mt-2 block">
        <h3 className="font-semibold leading-snug group-hover:text-brand">{record.title}</h3>
        {record.subtitle && <p className="text-sm text-muted">{record.subtitle}</p>}
      </Link>

      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        <Users size={11} className="shrink-0" />
        <span className="truncate">{record.authorsLabel}</span>
      </p>

      {record.abstract && (
        <p className="mt-2 line-clamp-2 text-sm text-muted">{record.abstract}</p>
      )}

      {(record.tags.length > 0 || record.subjects.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {record.subjects.slice(0, 4).map((s) => (
            <span key={s} className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand">
              {s}
            </span>
          ))}
          {record.tags.slice(0, 5).map((t) => (
            <span key={t} className="flex items-center gap-0.5 rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-muted">
              <Tag size={9} /> {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {record.primaryFile ? (
          <span className="flex items-center gap-1">
            <FileText size={11} />
            {record.primaryFile.fileName} · {formatBytes(record.totalBytes)}
            {record.fileCount > 1 && ` (+${record.fileCount - 1})`}
          </span>
        ) : (
          <span className="text-amber-500">sem arquivo anexado</span>
        )}
        {record.doi && <span>DOI {record.doi}</span>}
        {record.venue && <span className="truncate">{record.venue}</span>}
        <span className="flex items-center gap-1">
          <Download size={11} /> {record.downloadCount}
        </span>
        {record.linkCount > 0 && <span>{record.linkCount} vinculo(s)</span>}
        <span className="ml-auto">{formatDate(record.updatedAt)}</span>
      </div>
    </Card>
  );
}
