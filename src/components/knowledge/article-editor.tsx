"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Pencil } from "lucide-react";
import { Button, Input, Textarea, Badge } from "@/components/ui";
import { updateArticle } from "@/plugins/knowledge/actions";
import { formatDate } from "@/lib/utils";
import { MarkdownView } from "@/components/markdown/markdown-view";

export function ArticleEditor({
  article,
  canEdit,
}: {
  article: { id: string; title: string; content: string; tags: string; author: string; updatedAt: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [tags, setTags] = useState(article.tags);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{article.title}</h1>
            <p className="mt-1 text-xs text-muted">por {article.author} - atualizado {formatDate(article.updatedAt)}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {article.tags.split(",").filter(Boolean).map((t) => <Badge key={t} className="bg-surface2 text-muted">{t.trim()}</Badge>)}
            </div>
          </div>
          {canEdit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={15} /> Editar</Button>}
        </div>
        <article className="rounded-xl border border-border bg-surface p-6 text-sm">
          <MarkdownView content={article.content} />
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-lg" />
      <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags separadas por virgula" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Markdown</p>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={22} className="font-mono text-xs" />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Visualizacao</p>
          <div className="max-h-[520px] overflow-y-auto rounded-xl border border-border bg-surface p-4">
            <MarkdownView content={content} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
        <Button disabled={pending} onClick={() => start(async () => { await updateArticle({ id: article.id, title, content, tags }); setEditing(false); router.refresh(); })}>
          <Save size={15} /> Salvar
        </Button>
      </div>
    </div>
  );
}
