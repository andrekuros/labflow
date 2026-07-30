import "server-only";

import { chat, aiEnabled, type ChatMessage } from "@/lib/ai/provider";
import { ACADEMIC_TEXT_FIELDS } from "@/lib/academic/fields";
import { METHODOLOGY_KNOWLEDGE_BASE } from "@/lib/academic/methodology-knowledge";
import type { AcademicReviews } from "@/lib/academic/reviews";
import { ACADEMIC_PROGRAM_TYPE_LABELS, isAcademicProgram } from "@/lib/academic-program-meta";
import type { AcademicFormData, CourseRow, PendingRow } from "@/plugins/academic/actions";

export type AcademicReportInput = {
  userName: string;
  data: AcademicFormData;
  reviews: AcademicReviews;
};

function programLabel(program: string): string {
  return isAcademicProgram(program) ? ACADEMIC_PROGRAM_TYPE_LABELS[program] : program;
}

function countCourses(courses: CourseRow[]) {
  const done = courses.filter((c) => c.status === "concluida").length;
  return { total: courses.length, done, pending: courses.length - done };
}

function countPendingItems(pending: PendingRow[]) {
  const open = pending.filter((p) => p.status !== "concluido").length;
  const overdue = pending.filter((p) => {
    if (!p.dueDate || p.status === "concluido") return false;
    return new Date(p.dueDate) < new Date();
  }).length;
  return { total: pending.length, open, overdue };
}

function filledFields(data: AcademicFormData): string[] {
  return ACADEMIC_TEXT_FIELDS.filter((f) => data[f.key]?.trim()).map((f) => f.label);
}

function emptyFields(data: AcademicFormData): string[] {
  return ACADEMIC_TEXT_FIELDS.filter((f) => !data[f.key]?.trim()).map((f) => f.label);
}

function buildProfileContext(input: AcademicReportInput): string {
  const { userName, data, reviews } = input;
  const courses = countCourses(data.courses);
  const pending = countPendingItems(data.pending);

  const fieldsBlock = ACADEMIC_TEXT_FIELDS.map((f) => {
    const content = data[f.key]?.trim() || "(nao preenchido)";
    const review = reviews[f.key];
    const obs = review ? `\n  Observacao IA: ${review.observation}` : "";
    return `### ${f.label}\n${content}${obs}`;
  }).join("\n\n");

  return [
    `Aluno: ${userName}`,
    `Programa: ${programLabel(data.program)}`,
    `Status: ${data.status}`,
    `Orientador: ${data.advisorName || "N/I"}`,
    `Coorientador: ${data.coAdvisorName || "N/I"}`,
    `Inicio: ${data.startDate || "N/I"}`,
    `Previsao de defesa: ${data.expectedDefenseDate || "N/I"}`,
    `Disciplinas: ${courses.done}/${courses.total} concluidas`,
    `Pendencias: ${pending.open} abertas (${pending.overdue} vencidas)`,
    "",
    "## Campos e observacoes por campo",
    fieldsBlock,
    "",
    "## Disciplinas",
    data.courses.length
      ? data.courses.map((c) => `- ${c.code} ${c.name} [${c.status}]${c.grade ? ` nota ${c.grade}` : ""}`).join("\n")
      : "(nenhuma)",
    "",
    "## Pendencias administrativas",
    data.pending.length
      ? data.pending.map((p) => `- ${p.title} (${p.kind}) [${p.status}]${p.dueDate ? ` prazo ${p.dueDate}` : ""}`).join("\n")
      : "(nenhuma)",
  ].join("\n");
}

function maturityLabel(filled: number, total: number, reviewed: number): string {
  const pct = Math.round((filled / total) * 100);
  if (pct >= 90 && reviewed >= 8) return "Avancada — proposta bem estruturada com boa cobertura de analises";
  if (pct >= 70 && reviewed >= 5) return "Em consolidacao — base solida, requer refinamentos pontuais";
  if (pct >= 40) return "Em desenvolvimento — elementos presentes mas incompletos ou pouco articulados";
  return "Inicial — grande parte da proposta ainda precisa ser elaborada e analisada";
}

function offlineFinalReport(input: AcademicReportInput): string {
  const { userName, data, reviews } = input;
  const courses = countCourses(data.courses);
  const pending = countPendingItems(data.pending);
  const filled = filledFields(data);
  const empty = emptyFields(data);
  const reviewEntries = ACADEMIC_TEXT_FIELDS.filter((f) => reviews[f.key]);
  const now = new Date().toLocaleString("pt-BR");

  const strengths: string[] = [];
  const gaps: string[] = [];
  const actions: string[] = [];

  if (filled.length >= 7) strengths.push("Maioria dos campos metodologicos preenchidos");
  if (data.problemStatement.trim() && data.objective.trim()) strengths.push("Problema e objetivo declarados");
  if (data.methodology.trim().length > 150) strengths.push("Metodologia com nivel de detalhe razoavel");
  if (reviewEntries.length >= 5) strengths.push(`${reviewEntries.length} campos ja possuem observacao da IA`);
  if (courses.total > 0 && courses.done === courses.total) strengths.push("Todas as disciplinas registradas como concluidas");

  if (empty.length > 0) gaps.push(`Campos vazios: ${empty.join(", ")}`);
  if (reviewEntries.length < ACADEMIC_TEXT_FIELDS.length) {
    gaps.push(`Execute a analise por IA nos campos restantes (${ACADEMIC_TEXT_FIELDS.length - reviewEntries.length} pendentes)`);
  }
  if (!data.advisorName?.trim()) gaps.push("Orientador nao informado");
  if (pending.overdue > 0) gaps.push(`${pending.overdue} pendencia(s) com prazo vencido`);
  if (courses.pending > 0) gaps.push(`${courses.pending} disciplina(s) ainda nao concluidas`);

  for (const f of ACADEMIC_TEXT_FIELDS) {
    const r = reviews[f.key];
    if (r?.observation.toLowerCase().includes("vazio") || r?.observation.toLowerCase().includes("breve")) {
      actions.push(`Revisar ${f.label}: ${r.observation.slice(0, 120)}...`);
    }
  }
  if (actions.length === 0 && empty.length > 0) {
    actions.push(`Priorizar preenchimento de: ${empty.slice(0, 3).join(", ")}`);
  }
  if (actions.length === 0) {
    actions.push("Discutir o relatorio com o orientador e alinhar proximos marcos ate a defesa");
  }

  const synthesis = reviewEntries
    .map((f) => `**${f.label}:** ${reviews[f.key]!.observation}`)
    .join("\n\n");

  return `# Relatorio da Proposta Academica — ${userName}

**Gerado em:** ${now}  
**Programa:** ${programLabel(data.program)} | **Modo:** analise offline (configure IA para relatorio aprofundado)

## Resumo executivo

${maturityLabel(filled.length, ACADEMIC_TEXT_FIELDS.length, reviewEntries.length)}.

- **Campos preenchidos:** ${filled.length}/${ACADEMIC_TEXT_FIELDS.length}
- **Campos com observacao da IA:** ${reviewEntries.length}/${ACADEMIC_TEXT_FIELDS.length}
- **Disciplinas:** ${courses.done}/${courses.total} concluidas
- **Pendencias abertas:** ${pending.open}${pending.overdue ? ` (${pending.overdue} vencidas)` : ""}

## Coerencia geral da proposta

A proposta ${filled.length >= 6 ? "apresenta encadeamento parcial entre motivacao, problema e objetivos" : "ainda carece de articulacao entre os elementos metodologicos"}. ${
    data.methodology.trim() && data.problemStatement.trim()
      ? "Ha indicios de alinhamento entre problema declarado e desenho metodologico."
      : "Recomenda-se explicitar melhor a cadeia problema → objetivos → metodos."
  }

## Sintese das observacoes por campo

${synthesis || "_Nenhuma observacao por campo registrada. Execute \"Analisar todos os campos\" antes de gerar o relatorio._"}

## Pontos fortes

${strengths.length ? strengths.map((s) => `- ${s}`).join("\n") : "- Ainda em identificacao; complete e analise os campos"}

## Lacunas e riscos

${gaps.length ? gaps.map((g) => `- ${g}`).join("\n") : "- Nenhuma lacuna critica identificada no modo offline"}

## Recomendacoes prioritarias

${actions.slice(0, 6).map((a, i) => `${i + 1}. ${a}`).join("\n")}

## Situacao do programa

| Aspecto | Situacao |
|---------|----------|
| Orientador | ${data.advisorName || "Nao informado"} |
| Inicio | ${data.startDate || "N/I"} |
| Previsao de defesa | ${data.expectedDefenseDate || "N/I"} |
| Disciplinas concluidas | ${courses.done}/${courses.total} |
| Pendencias abertas | ${pending.open} |

## Proximos passos sugeridos

1. Completar campos vazios e reexecutar analises por IA
2. Validar coerencia com o orientador (problema, metodos, resultados)
3. Atualizar pendencias e disciplinas conforme evolucao real do programa
`;
}

export async function generateAcademicFinalReportContent(
  input: AcademicReportInput,
): Promise<{ markdown: string; reviewer: "ai" | "offline" }> {
  if (!(await aiEnabled())) {
    return { markdown: offlineFinalReport(input), reviewer: "offline" };
  }

  const context = buildProfileContext(input);
  const prompt = `Voce e um comite avaliador academico. Produza um RELATORIO FINAL em Markdown sobre a situacao da proposta de pesquisa do aluno, integrando TODOS os aspectos abaixo (conteudo dos campos + observacoes ja feitas por campo).

BASE METODOLOGICA:
${METHODOLOGY_KNOWLEDGE_BASE}

DADOS COMPLETOS DO PERFIL:
${context}

Estruture o relatorio em Markdown com estas secoes (use os titulos exatos):

# Relatorio da Proposta Academica — ${input.userName}

## Resumo executivo
(3-5 frases: situacao geral, maturidade da proposta, principal veredito)

## Coerencia da proposta
(analise da cadeia motivacao → problema → objetivos → hipoteses → referencial → metodologia → contribuicao → resultados)

## Analise por dimensao
(subsecoes ### para cada campo metodologico relevante, sintetizando conteudo E observacoes previas)

## Pontos fortes
(lista)

## Lacunas, inconsistencias e riscos
(lista objetiva)

## Disciplinas e pendencias
(situacao administrativa e impacto no cronograma)

## Recomendacoes prioritarias
(lista numerada, maximo 8 itens, acionaveis)

## Conclusao
(paragrafo final com prognostico e proximos passos)

Regras:
- Portugues do Brasil, tom construtivo e academico
- Cite evidencias do texto do aluno; nao invente dados
- Integre as observacoes por campo; nao as repita verbatim sem sintese
- Se campo vazio, mencione como lacuna
- Nao use JSON; apenas Markdown`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "Voce redige relatorios academicos rigorosos em Markdown. Seja especifico ao conteudo fornecido.",
    },
    { role: "user", content: prompt },
  ];

  try {
    const raw = await chat(messages);
    const markdown = raw.trim();
    if (markdown.length > 200) {
      return { markdown, reviewer: "ai" };
    }
  } catch (err) {
    console.error("[academic-final-report] AI generation failed", err);
  }

  return { markdown: offlineFinalReport(input), reviewer: "offline" };
}
