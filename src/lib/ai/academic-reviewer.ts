import "server-only";

import { chat, aiEnabled, type ChatMessage } from "@/lib/ai/provider";
import { ACADEMIC_FIELD_MAP } from "@/lib/academic/fields";
import { METHODOLOGY_KNOWLEDGE_BASE } from "@/lib/academic/methodology-knowledge";
import type { AcademicFieldReview, AcademicReviewFieldKey } from "@/lib/academic/reviews";
import { ACADEMIC_PROGRAM_TYPE_LABELS, isAcademicProgram } from "@/lib/academic-program-meta";

const MIN_CHARS = 40;

function programLabel(program: string): string {
  return isAcademicProgram(program) ? ACADEMIC_PROGRAM_TYPE_LABELS[program] : program;
}

function offlineReview(
  field: AcademicReviewFieldKey,
  content: string,
  program: string,
): AcademicFieldReview {
  const def = ACADEMIC_FIELD_MAP[field];
  const text = content.trim();
  const now = new Date().toISOString();

  if (!text) {
    return {
      observation: `Campo vazio. ${def.hint}`,
      reviewedAt: now,
      reviewer: "offline",
    };
  }

  if (text.length < MIN_CHARS) {
    return {
      observation: `Texto muito breve (${text.length} caracteres). Desenvolva com mais detalhe: ${def.hint}`,
      reviewedAt: now,
      reviewer: "offline",
    };
  }

  const issues: string[] = [];
  const strengths: string[] = [];

  if (field === "objective" && !/\b(analisar|investigar|propor|avaliar|caracterizar|desenvolver|comparar|identificar|verificar|examinar)\b/i.test(text)) {
    issues.push("considere iniciar o objetivo com verbo no infinitivo (ex.: analisar, investigar, propor)");
  }
  if (field === "problemStatement" && !text.includes("?") && text.length < 120) {
    issues.push("formule explicitamente a questão ou lacuna investigável");
  }
  if (field === "hypothesis" && text.length < 80) {
    issues.push("detalhe a relação ou proposição que pretende examinar");
  }
  if (field === "methodology") {
    const hasApproach = /\b(qualitativa|quantitativa|mista|experimental|survey|estudo de caso|revisão)\b/i.test(text);
    if (!hasApproach) issues.push("indique a abordagem e o tipo de estudo");
    const hasSample = /\b(amostra|população|participantes|sujeitos|casos)\b/i.test(text);
    if (!hasSample) issues.push("descreva população ou amostra");
  }
  if (field === "theoreticalFramework" && !/\b(segundo|conforme|autor|teoria|conceito|modelo)\b/i.test(text)) {
    issues.push("articule autores/teorias com o problema, não apenas cite");
  }
  if (field === "limitations" && /\b(tempo limitado|pouco tempo)\b/i.test(text) && text.length < 100) {
    issues.push("explique como a limitação afeta os resultados, não só mencione falta de tempo");
  }

  if (text.length >= 200) strengths.push("extensão adequada para análise preliminar");
  if (/\b(objetivo|problema|hipótese|método|resultado)\b/i.test(text) && field !== "notes") {
    strengths.push("há articulação com vocabulário metodológico");
  }

  const parts: string[] = [];
  parts.push(`Análise offline (IA não configurada) para ${def.label} — programa ${programLabel(program)}.`);
  if (strengths.length) parts.push(`Pontos positivos: ${strengths.join("; ")}.`);
  if (issues.length) parts.push(`Sugestões: ${issues.join("; ")}.`);
  if (!issues.length) parts.push(`O texto aborda elementos básicos; refine com seu orientador e reavalie com IA quando disponível.`);
  parts.push(`Referência: ${def.hint}`);

  return {
    observation: parts.join(" "),
    reviewedAt: now,
    reviewer: "offline",
  };
}

function parseReviewJson(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const json = JSON.parse(trimmed.slice(start, end + 1)) as { observation?: unknown };
    return typeof json.observation === "string" && json.observation.trim()
      ? json.observation.trim()
      : null;
  } catch {
    return null;
  }
}

export async function reviewAcademicFieldContent(
  field: AcademicReviewFieldKey,
  content: string,
  program: string,
  peerContext?: Partial<Record<AcademicReviewFieldKey, string>>,
): Promise<AcademicFieldReview> {
  const def = ACADEMIC_FIELD_MAP[field];
  const now = new Date().toISOString();

  if (!(await aiEnabled())) {
    return offlineReview(field, content, program);
  }

  const contextBlock = peerContext
    ? Object.entries(peerContext)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `- ${ACADEMIC_FIELD_MAP[k as AcademicReviewFieldKey]?.label ?? k}: ${v!.trim().slice(0, 400)}`)
        .join("\n")
    : "";

  const prompt = `Voce e um orientador academico especializado em metodologia cientifica.
Avalie o texto do aluno no campo "${def.label}" considerando o programa ${programLabel(program)}.

BASE DE CONHECIMENTO (Metodologia Cientifica):
${METHODOLOGY_KNOWLEDGE_BASE}

CRITERIOS ESPECIFICOS DO CAMPO:
${def.reviewCriteria}

INSTRUCAO DE PREENCHIMENTO PARA O ALUNO:
${def.hint}

${contextBlock ? `CONTEXTO DE OUTROS CAMPOS DO MESMO PERFIL:\n${contextBlock}\n` : ""}
TEXTO DO ALUNO:
"""
${content.trim() || "(vazio)"}
"""

Responda SOMENTE com JSON valido (sem markdown):
{"observation":"2 a 5 frases em portugues: analise a essencia do conteudo, um ponto forte e melhorias concretas. Tom construtivo e especifico ao texto, evite cliches."}`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "Voce avalia projetos de pesquisa com rigor academico e feedback construtivo. Responda somente JSON.",
    },
    { role: "user", content: prompt },
  ];

  try {
    const raw = await chat(messages);
    const observation = parseReviewJson(raw);
    if (observation) {
      return { observation, reviewedAt: now, reviewer: "ai" };
    }
  } catch (err) {
    console.error("[academic-reviewer] AI review failed", err);
  }

  return offlineReview(field, content, program);
}
