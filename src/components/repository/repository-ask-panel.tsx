"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { Loader2, Send, Sparkles, AlertTriangle } from "lucide-react";
import { askRepositoryAction } from "@/plugins/repository/actions";

type Source = { id: string; title: string; href?: string; path?: string | null };
type Turn = { question: string; answer: string; sources: Source[]; degraded?: boolean };

/**
 * Q&A over the repository corpus.
 *
 * "Escopo" is explicit on purpose: answering from the visible results is a very
 * different claim from answering from the whole acervo, and the reader has to
 * know which one they got.
 */
export function RepositoryAskPanel({
  recordIds,
  totalInScope,
  resultCount,
  hasFilters,
}: {
  recordIds: string[];
  totalInScope: number;
  resultCount: number;
  hasFilters: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"results" | "all">(hasFilters ? "results" : "all");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return;
    setError("");
    start(async () => {
      const r = await askRepositoryAction({
        question: q,
        recordIds: scope === "results" ? recordIds : undefined,
        scopeLabel: scope === "results" ? `${resultCount} resultado(s) filtrado(s)` : undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTurns((prev) => [...prev, { question: q, answer: r.answer, sources: r.sources, degraded: r.degraded }]);
      setQuestion("");
    });
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={14} className="text-brand" /> Perguntar ao acervo
        </h3>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setScope("results")}
            disabled={recordIds.length === 0}
            className={`rounded px-2 py-1 transition ${
              scope === "results" ? "bg-brand text-white" : "text-muted hover:bg-surface2 disabled:opacity-40"
            }`}
          >
            Resultados ({resultCount})
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`rounded px-2 py-1 transition ${
              scope === "all" ? "bg-brand text-white" : "text-muted hover:bg-surface2"
            }`}
          >
            Todo o acervo
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted">
        {scope === "results"
          ? `A resposta usa apenas os ${resultCount} deposito(s) desta pagina de resultados.`
          : `A resposta pode usar qualquer deposito que voce tem permissao para ler.`}
        {" "}Somente o texto extraido dos arquivos e indexado — arquivos sem texto (imagens, PDFs digitalizados) nao entram.
      </p>

      {turns.length > 0 && (
        <div className="mb-3 space-y-3">
          {turns.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface2/40 p-3">
              <p className="text-sm font-medium">{t.question}</p>
              {t.degraded && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle size={11} /> resposta degradada — provedor de IA indisponivel
                </p>
              )}
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{t.answer}</p>
              {t.sources.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <p className="mb-1 text-[11px] font-medium text-muted">Fontes</p>
                  <ol className="space-y-0.5 text-xs">
                    {t.sources.map((s, idx) => (
                      <li key={`${s.id}-${idx}`} className="flex gap-1.5">
                        <span className="text-muted">[{idx + 1}]</span>
                        <Link href={s.href ?? `/repository/${s.id}`} className="truncate hover:text-brand">
                          {s.title}
                        </Link>
                        {s.path && <span className="shrink-0 font-mono text-[10px] text-muted">{s.path}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-2 flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle size={12} /> {error}
        </p>
      )}

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: quais protocolos usam calibracao acustica?"
          className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Perguntar
        </button>
      </form>
      {totalInScope > resultCount && scope === "results" && (
        <p className="mt-1.5 text-[11px] text-muted">
          A busca tem {totalInScope} resultado(s) no total; esta pagina traz {resultCount}. Use
          &quot;Todo o acervo&quot; para nao limitar a resposta a esta pagina.
        </p>
      )}
    </Card>
  );
}
