import "server-only";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import { ARTIFACTS_FORMAT_VERSION } from "@/lib/artifacts/schema";

export type WbsMappingInput = {
  projectName: string;
  workPackages: { id: string; code: string | null; name: string; parentId: string | null }[];
  tasks: { id: string; title: string; description: string | null; status: string; estimate: number | null }[];
};

export type TaskWbsMapping = {
  taskId: string;
  workPackageCode: string;
  estimate: number;
  rationale: string;
};

export type WbsMappingResult = {
  version: string;
  taskMappings: TaskWbsMapping[];
};

function buildPrompt(input: WbsMappingInput): string {
  const wbsLines = input.workPackages
    .map((w) => `- ${w.code ?? w.id}: ${w.name}`)
    .join("\n");

  const taskLines = input.tasks
    .map((t) => {
      const desc = t.description ? ` | ${t.description.slice(0, 120)}` : "";
      const est = t.estimate != null ? ` | estimativa atual: ${t.estimate}h` : "";
      return `- [${t.id}] ${t.title} (status: ${t.status})${desc}${est}`;
    })
    .join("\n");

  return `Voce e um especialista em gestao de projetos e WBS (Work Breakdown Structure).

Projeto: "${input.projectName}"

PACOTES WBS DISPONIVEIS:
${wbsLines || "(nenhum)"}

TAREFAS A MAPEAR:
${taskLines}

Retorne APENAS JSON valido (sem markdown):
{
  "version": "${ARTIFACTS_FORMAT_VERSION}",
  "taskMappings": [
    {
      "taskId": "id da tarefa",
      "workPackageCode": "codigo WBS exato da lista",
      "estimate": 8,
      "rationale": "breve justificativa"
    }
  ]
}

Regras:
- Cada tarefa listada deve aparecer exatamente uma vez em taskMappings
- workPackageCode deve corresponder a um codigo WBS da lista (ou id se nao houver codigo)
- estimate em horas de trabalho esperado, proporcional a complexidade e escopo
- Distribua o esforco de forma coerente entre os pacotes WBS
- Texto em portugues
- Nao invente pacotes WBS novos`;
}

function extractJson(text: string): WbsMappingResult {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("IA nao retornou JSON valido");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as WbsMappingResult;
  if (!Array.isArray(parsed.taskMappings) || parsed.taskMappings.length === 0) {
    throw new Error("Nenhum mapeamento retornado pela IA");
  }
  return parsed;
}

export async function mapTasksToWbsWithAi(input: WbsMappingInput): Promise<WbsMappingResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: "Voce retorna apenas JSON valido para mapeamento de tarefas em WBS." },
    { role: "user", content: buildPrompt(input) },
  ];
  const raw = await chat(messages);
  return extractJson(raw);
}
