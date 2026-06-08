"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Pencil } from "lucide-react";
import { Button, Input, Textarea, Badge } from "@/components/ui";
import { updateArticle } from "@/app/actions/knowledge";
import { formatDate } from "@/lib/utils";

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
        <article className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-6 text-sm leading-relaxed">
          {article.content || <span className="text-muted">Sem conteudo.</span>}
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-lg" />
      <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags separadas por virgula" />
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={18} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
        <Button disabled={pending} onClick={() => start(async () => { await updateArticle({ id: article.id, title, content, tags }); setEditing(false); router.refresh(); })}>
          <Save size={15} /> Salvar
        </Button>
      </div>
    </div>
  );
}
