import "server-only";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import { loadProjectContextForAi } from "@/lib/ai/project-context";
import type { TaskChecklistItem } from "@/lib/task-checklist";

export type TaskStepsInput = {
  projectId: string;
  taskTitle: string;
  taskDescription: string | null;
  taskStatus: string;
  taskPriority: string;
  workPackageLabel?: string | null;
  existingSteps?: TaskChecklistItem[];
};

export type TaskStepsResult = {
  steps: { title: string }[];
};

function buildPrompt(input: TaskStepsInput, projectContext: string): string {
  const existing =
    input.existingSteps && input.existingSteps.length > 0
      ? `\nSTEPS JA EXISTENTES (pode complementar ou reorganizar):\n${input.existingSteps.map((s) => `- [${s.done ? "x" : " "}] ${s.title}`).join("\n")}\n`
      : "";

  return `Voce e um especialista em planejamento de trabalho de pesquisa e engenharia.

CONTEXTO DO PROJETO:
---
${projectContext.slice(0, 14000)}
---

TAREFA A SUBDIVIDIR:
- Titulo: ${input.taskTitle}
- Descricao: ${input.taskDescription ?? "(sem descricao)"}
- Status: ${input.taskStatus}
- Prioridade: ${input.taskPriority}
${input.workPackageLabel ? `- Pacote WBS: ${input.workPackageLabel}` : ""}
${existing}

Retorne APENAS JSON valido (sem markdown):
{
  "steps": [
    { "title": "Passo acionavel e especifico" }
  ]
}

Regras:
- Gere entre 3 e 12 passos ordenados logicamente
- Cada passo deve ser concreto, verificavel e acionavel
- Alinhe com requisitos, WBS, entregaveis e CONOPS do projeto quando relevante
- Nao duplique passos ja existentes salvo se precisar refina-los
- Texto em portugues
- Verbos no infinitivo ou imperativo`;
}

function extractJson(text: string): TaskStepsResult {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("IA nao retornou JSON valido");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as TaskStepsResult;
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Nenhum passo retornado pela IA");
  }
  return parsed;
}

export async function generateTaskStepsWithAi(input: TaskStepsInput): Promise<TaskStepsResult> {
  const projectContext = await loadProjectContextForAi(input.projectId);
  const messages: ChatMessage[] = [
    { role: "system", content: "Voce retorna apenas JSON valido com steps de checklist para tarefas." },
    { role: "user", content: buildPrompt(input, projectContext) },
  ];
  const raw = await chat(messages);
  return extractJson(raw);
}
