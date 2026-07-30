"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, FileText } from "lucide-react";
import { Button, Card, Textarea, Label } from "@/components/ui";
import { generateTasksFromMarkdownAction } from "@/plugins/projects/conops-actions";

export function TaskImportPanel({
  projectId,
  writable,
}: {
  projectId: string;
  writable: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setMarkdown(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  if (!writable) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Importar tarefas de Markdown</h2>
        <p className="mt-2 text-sm text-muted">Sem permissao de escrita neste projeto.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText size={16} className="text-brand" />
        <h2 className="text-sm font-semibold">Importar tarefas de Markdown</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Cole ou envie um arquivo .md com atas, listas de acoes, checklists ou notas. A IA extrai tarefas
        sugeridas para este projeto — voce revisa e aceita na aba <strong>Revisao IA</strong>.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = "";
        }}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Enviar arquivo .md
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Conteudo Markdown</Label>
        <Textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={16}
          placeholder={`# Reuniao de acompanhamento\n\n## Acoes\n- [ ] Revisar protocolo EEG\n- [ ] Calibrar equipamento\n- [ ] Enviar relatorio parcial ate sexta`}
          className="font-mono text-xs"
        />
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      {info && <p className="mt-3 text-xs text-brand">{info}</p>}

      <div className="mt-4">
        <Button
          disabled={pending || !markdown.trim()}
          onClick={() =>
            start(async () => {
              setError("");
              setInfo("");
              try {
                const result = await generateTasksFromMarkdownAction(projectId, markdown);
                if (result.created === 0) {
                  setError(
                    result.skipped > 0
                      ? `Nenhuma tarefa nova (${result.skipped} duplicata(s) filtrada(s)).`
                      : "Nenhuma tarefa identificada no texto.",
                  );
                } else {
                  const parts = [`${result.created} tarefa(s) sugerida(s)`];
                  if (result.skipped > 0) parts.push(`${result.skipped} duplicata(s) ignorada(s)`);
                  setInfo(`${parts.join(" · ")}. Va para Revisao IA para aceitar.`);
                  setMarkdown("");
                  router.push(`/projects/${projectId}?tab=review`);
                  router.refresh();
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao processar");
              }
            })
          }
        >
          <Sparkles size={14} /> Extrair tarefas com IA
        </Button>
      </div>
    </Card>
  );
}
