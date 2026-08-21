"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Pencil, Trash2, ExternalLink, Cloud, Sparkles } from "lucide-react";
import { Button, Input, Textarea, Badge } from "@/components/ui";
import { AdminOnlyBadge } from "@/components/knowledge/admin-only-badge";
import { updateArticle, deleteArticle, askAboutArticleAction } from "@/plugins/knowledge/actions";
import { formatDate } from "@/lib/utils";
import { MarkdownView } from "@/components/markdown/markdown-view";

export function ArticleEditor({
  article,
  canEdit,
  canDelete,
  externalSource,
  nextcloudFileUrl,
  adminOnly = false,
}: {
  article: {
    id: string;
    title: string;
    content: string;
    extractedText?: string;
    tags: string;
    author: string;
    updatedAt: string;
    kind?: string;
    mimeType?: string | null;
    fileName?: string | null;
    indexed?: boolean;
    externalPath?: string | null;
  };
  canEdit: boolean;
  canDelete: boolean;
  externalSource?: string | null;
  nextcloudFileUrl?: string | null;
  adminOnly?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [tags, setTags] = useState(article.tags);
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const isNextcloud = externalSource === "nextcloud";
  const isFile = article.kind === "file";
  const isPdf = isFile && (article.mimeType === "application/pdf" || (article.fileName ?? "").toLowerCase().endsWith(".pdf"));

  const reader = (
    <article className="rounded-xl border border-border bg-surface p-6 text-sm">
      {isPdf ? (
        <iframe
          title={article.title}
          src={`/api/knowledge/file/${article.id}`}
          className="h-[70vh] w-full rounded-lg border border-border bg-white"
        />
      ) : isFile ? (
        <pre className="whitespace-pre-wrap text-xs text-muted">
          {article.extractedText || "Sem texto extraido. O arquivo permanece no Nextcloud."}
        </pre>
      ) : (
        <MarkdownView content={article.content} />
      )}
    </article>
  );

  if (!editing) {
    return (
      <div>
        {isNextcloud && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <Cloud size={16} className="text-blue-400" />
              <span>
                {isFile
                  ? "Arquivo no vault Nextcloud. O LabFlow guarda o indice e o texto extraido para a IA."
                  : "Pagina no vault Nextcloud. Salvar no LabFlow envia de volta ao vault."}
              </span>
            </div>
            {nextcloudFileUrl && (
              <a
                href={nextcloudFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:underline"
              >
                Abrir no Nextcloud <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{article.title}</h1>
              {adminOnly && <AdminOnlyBadge />}
              {isNextcloud && <Badge className="bg-surface2 text-muted">Nextcloud</Badge>}
              {isFile && <Badge className="bg-surface2 text-muted">{article.fileName?.split(".").pop()?.toUpperCase() ?? "FILE"}</Badge>}
              {article.indexed && <Badge className="bg-surface2 text-muted">Indexado IA</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted">
              por {article.author} - atualizado {formatDate(article.updatedAt)}
              {article.externalPath ? ` · ${article.externalPath}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {article.tags.split(",").filter(Boolean).map((t) => <Badge key={t} className="bg-surface2 text-muted">{t.trim()}</Badge>)}
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && !isFile && (
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={15} /> Editar</Button>
            )}
            {canDelete && !isNextcloud && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Excluir este artigo permanentemente?")) return;
                  start(async () => {
                    await deleteArticle(article.id);
                    router.push("/knowledge");
                    router.refresh();
                  });
                }}
              >
                <Trash2 size={15} /> Excluir
              </Button>
            )}
          </div>
        </div>
        {reader}
        <div className="mt-4 rounded-xl border border-border p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles size={13} /> Perguntar sobre este documento
          </p>
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pergunta sobre o conteudo..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && question.trim()) {
                  start(async () => {
                    const r = await askAboutArticleAction(article.id, question);
                    setAnswer(r.answer);
                  });
                }
              }}
            />
            <Button
              disabled={pending || !question.trim()}
              onClick={() =>
                start(async () => {
                  const r = await askAboutArticleAction(article.id, question);
                  setAnswer(r.answer);
                })
              }
            >
              Perguntar
            </Button>
          </div>
          {answer && <p className="mt-3 whitespace-pre-wrap text-sm">{answer}</p>}
        </div>
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
          <Save size={15} /> {isNextcloud ? "Salvar no vault" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
