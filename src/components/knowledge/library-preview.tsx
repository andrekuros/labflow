"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { FileText, File, Sparkles } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { getLibraryArticleAction, askAboutArticleAction } from "@/plugins/knowledge/actions";

export function LibraryPreview({ articleId }: { articleId: string }) {
  const [article, setArticle] = useState<Awaited<ReturnType<typeof getLibraryArticleAction>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setAnswer(null);
    setQuestion("");
    start(async () => {
      try {
        setError(null);
        setArticle(await getLibraryArticleAction(articleId));
      } catch (err) {
        setArticle(null);
        setError(err instanceof Error ? err.message : "Falha ao carregar");
      }
    });
  }, [articleId]);

  if (error) return <p className="p-4 text-sm text-muted">{error}</p>;
  if (!article) return <p className="p-4 text-sm text-muted">Carregando...</p>;

  const isPdf = article.kind === "file" && (article.mimeType === "application/pdf" || (article.fileName ?? "").toLowerCase().endsWith(".pdf"));
  const isFile = article.kind === "file";

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{article.title}</h2>
          {article.projectKey && <Badge color={article.projectColor ?? "#6366f1"}>{article.projectKey}</Badge>}
          {isFile && <Badge className="bg-surface2 text-muted">{article.fileName?.split(".").pop()?.toUpperCase() ?? "FILE"}</Badge>}
          {article.indexed && <Badge className="bg-surface2 text-muted">IA</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted">
          {article.externalPath ?? "artigo local"} · {article.author}
        </p>
        <Link href={`/knowledge/${article.id}`} className="mt-1 inline-block text-xs text-brand hover:underline">
          Abrir pagina completa
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isPdf ? (
          <iframe
            title={article.title}
            src={`/api/knowledge/file/${article.id}`}
            className="h-[480px] w-full rounded-lg border border-border bg-white"
          />
        ) : isFile ? (
          <pre className="whitespace-pre-wrap text-xs text-muted">{article.extractedText || "Sem texto extraido para a IA."}</pre>
        ) : (
          <MarkdownView content={article.content} />
        )}
      </div>

      <div className="border-t border-border p-3">
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted">
          <Sparkles size={12} /> Perguntar sobre este documento
        </p>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="O que este documento diz sobre...?"
            className="h-8 text-xs"
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
            size="sm"
            disabled={pending || !question.trim()}
            onClick={() =>
              start(async () => {
                const r = await askAboutArticleAction(article.id, question);
                setAnswer(r.answer);
              })
            }
          >
            <Sparkles size={14} />
          </Button>
        </div>
        {answer && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{answer}</p>}
      </div>
    </div>
  );
}

export function KindIcon({ kind }: { kind: string; fileName?: string | null }) {
  if (kind === "file") return <File size={14} className="shrink-0 text-muted" />;
  return <FileText size={14} className="shrink-0 text-muted" />;
}
