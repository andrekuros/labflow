import "server-only";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import type { ArtifactsBundle, ConopsData, ArtifactType } from "@/lib/artifacts/schema";
import { ARTIFACTS_FORMAT_VERSION } from "@/lib/artifacts/schema";

const TYPE_LABELS: Record<ArtifactType, string> = {
  requirement: "requirements",
  task: "tasks",
  deliverable: "deliverables",
  work_package: "workPackages",
  milestone: "milestones",
  system_element: "systemElements",
  verification_case: "verificationCases",
};

export type GenerationMode = "complement" | "replace_pending" | "append";

function buildPrompt(
  conops: ConopsData,
  projectName: string,
  types: ArtifactType[],
  existingLines: string[],
  mode: GenerationMode,
) {
  const sections = types.map((t) => TYPE_LABELS[t]).join(", ");
  const existingBlock =
    existingLines.length > 0
      ? `\nARTEFATOS JA EXISTENTES (nao duplique titulos/codigos):\n${existingLines.slice(0, 40).join("\n")}\n`
      : "";

  const instruction =
    mode === "append"
      ? "Gere artefatos novos mesmo que similares aos existentes."
      : "Gere apenas artefatos NOVOS e COMPLEMENTARES. Nao repita codigos, titulos ou entregaveis ja listados.";

  return `Voce e um engenheiro de sistemas. Com base no CONOPS abaixo, gere artefatos de projeto em JSON.

PROJETO: ${projectName}
${existingBlock}
CONOPS:
- Missao: ${conops.mission}
- Escopo: ${conops.scope}
- Stakeholders: ${conops.stakeholders}
- Ambiente operacional: ${conops.operatingEnvironment}
- Conceito de operacoes: ${conops.conceptOfOperations}
- Restricoes: ${conops.constraints}
- Criterios de sucesso: ${conops.successCriteria}
- Premissas: ${conops.assumptions}

Gere APENAS um JSON valido (sem markdown) no formato:
{
  "version": "${ARTIFACTS_FORMAT_VERSION}",
  "requirements": [{ "code": "SYS-001", "title": "...", "description": "...", "level": "system", "kind": "functional", "priority": "high" }],
  "tasks": [{ "title": "...", "description": "...", "status": "backlog", "priority": "medium" }],
  "deliverables": [{ "name": "...", "description": "...", "acceptance": "..." }],
  "workPackages": [{ "code": "1.1", "name": "...", "description": "..." }],
  "milestones": [{ "name": "...", "gate": "PDR", "kind": "verification" }],
  "systemElements": [{ "name": "...", "kind": "subsystem", "description": "..." }],
  "verificationCases": [{ "name": "...", "method": "test", "requirementCode": "SYS-001" }]
}

Inclua somente estas secoes: ${sections}.
${instruction}
Gere entre 3 e 8 itens por secao solicitada. Texto em portugues.`;
}

function extractJson(text: string): ArtifactsBundle {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("IA nao retornou JSON valido");
  return JSON.parse(trimmed.slice(start, end + 1)) as ArtifactsBundle;
}

export async function generateArtifactsFromConops(
  conops: ConopsData,
  projectName: string,
  types: ArtifactType[],
  existingLines: string[] = [],
  mode: GenerationMode = "complement",
): Promise<ArtifactsBundle> {
  const messages: ChatMessage[] = [
    { role: "system", content: "Responda somente com JSON. Sem explicacoes." },
    { role: "user", content: buildPrompt(conops, projectName, types, existingLines, mode) },
  ];
  const raw = await chat(messages);
  return extractJson(raw);
}
