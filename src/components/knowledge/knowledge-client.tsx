"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Search, Sparkles } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label, Badge } from "@/components/ui";
import { createArticle, searchKnowledge, type KnowledgeSearchResult } from "@/app/actions/knowledge";

type ArticleItem = {
  id: string; title: string; tags: string; updatedAt: string;
  projectKey: string | null; projectColor: string | null; author: string;
};

export function KnowledgeClient({
  articles,
  projects,
}: {
  articles: ArticleItem[];
  projects: { id: string; key: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [open, setOpen] = useState(false);

  function runSearch() {
    if (!query.trim()) { setResults(null); return; }
    startSearch(async () => setResults(await searchKnowledge(query)));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px]">
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
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo artigo</Button>
      </div>

      {results && (
        <Card className="mb-5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Resultados ({results.articles.length})</h3>
            <button onClick={() => { setResults(null); setQuery(""); }} className="text-xs text-muted hover:text-fg">limpar</button>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link key={a.id} href={`/knowledge/${a.id}`}>
            <Card className="h-full p-4 transition hover:border-brand/60">
              <div className="mb-2 flex items-center gap-2">
                {a.projectKey && <Badge color={a.projectColor ?? "#6366f1"}>{a.projectKey}</Badge>}
              </div>
              <h3 className="font-medium">{a.title}</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                {a.tags.split(",").filter(Boolean).map((t) => <Badge key={t} className="bg-surface2 text-muted">{t.trim()}</Badge>)}
              </div>
              <p className="mt-3 text-xs text-muted">{a.author}</p>
            </Card>
          </Link>
        ))}
        {articles.length === 0 && <p className="text-sm text-muted">Nenhum artigo ainda.</p>}
      </div>

      {open && (
        <NewArticleModal projects={projects} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

function NewArticleModal({ projects, onClose, onSaved }: { projects: { id: string; key: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
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
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Titulo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Conteudo</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Notas, decisoes, protocolos, aprendizados..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tags (separadas por virgula)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="eeg, protocolo" /></div>
            <div><Label>Projeto</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
                <option value="">(geral)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.key} - {p.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={pending || !title} onClick={() => start(async () => { await createArticle({ title, content, tags, projectId: projectId || null }); onSaved(); })}>Publicar</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
