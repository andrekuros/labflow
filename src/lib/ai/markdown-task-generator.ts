import "server-only";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import type { ArtifactsBundle } from "@/lib/artifacts/schema";
import { ARTIFACTS_FORMAT_VERSION } from "@/lib/artifacts/schema";

function buildPrompt(markdown: string, projectName: string, existingTitles: string[]) {
  const existingBlock =
    existingTitles.length > 0
      ? `\nTAREFAS JA EXISTENTES (nao duplique):\n${existingTitles.slice(0, 50).map((t) => `- ${t}`).join("\n")}\n`
      : "";

  return `Voce e um assistente de gestao de projetos. Analise o texto Markdown abaixo e extraia tarefas acionaveis para o projeto "${projectName}".

O texto pode ser: atas de reuniao, listas de acoes, checklists, notas de planejamento, backlog informal, etc.

${existingBlock}
TEXTO MARKDOWN:
---
${markdown.slice(0, 12000)}
---

Retorne APENAS JSON valido (sem markdown) no formato:
{
  "version": "${ARTIFACTS_FORMAT_VERSION}",
  "tasks": [
    {
      "title": "Titulo curto da tarefa",
      "description": "Contexto ou detalhes extraidos do texto",
      "status": "backlog",
      "priority": "low|medium|high|urgent",
      "workPackageCode": "codigo WBS opcional se inferivel",
      "estimate": 4
    }
  ]
}

Regras:
- Extraia apenas tarefas concretas e acionaveis (verbos no infinitivo ou imperativo)
- Nao invente tarefas que nao estejam implicitas ou explicitas no texto
- Se houver prazos ou responsaveis no texto, inclua na description
- Gere entre 1 e 25 tarefas conforme o conteudo
- Texto em portugues
- Nao duplique tarefas ja existentes`;
}

function extractJson(text: string): ArtifactsBundle {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("IA nao retornou JSON valido");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as ArtifactsBundle;
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error("Nenhuma tarefa identificada no texto");
  }
  return parsed;
}

export async function generateTasksFromMarkdown(
  markdown: string,
  projectName: string,
  existingTitles: string[] = [],
): Promise<ArtifactsBundle> {
  const messages: ChatMessage[] = [
    { role: "user", content: buildPrompt(markdown, projectName, existingTitles) },
  ];
  const reply = await chat(messages);
  return extractJson(reply);
}
