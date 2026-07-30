/** Campos de metodologia — instruções para alunos (client + server). */

import type { AcademicReviewFieldKey } from "@/lib/academic/reviews";

export type AcademicTextFieldDef = {
  key: AcademicReviewFieldKey;
  label: string;
  rows: number;
  hint: string;
  reviewCriteria: string;
};

export const METHODOLOGY_INTRO = `Preencha cada campo com clareza, objetividade e coerência entre si. A motivação contextualiza o interesse; o problema delimita a lacuna; objetivos e hipóteses orientam o desenho; referencial e metodologia sustentam a investigação; contribuição e resultados explicitam o valor esperado; limitações demonstram maturidade científica.`;

export const ACADEMIC_TEXT_FIELDS: AcademicTextFieldDef[] = [
  {
    key: "motivation",
    label: "Motivacao",
    rows: 3,
    hint: "Explique por que o tema é relevante para a ciência, para a sociedade ou para o laboratório. Evite opiniões vagas; cite contexto, demanda ou lacuna que justifique a pesquisa.",
    reviewCriteria:
      "Avalie se há relevância explícita, contexto situado (área, cenário, demanda) e conexão com o problema de pesquisa. Penalize generalidades, jargão vazio e motivação puramente pessoal sem amparo científico.",
  },
  {
    key: "objective",
    label: "Objetivo",
    rows: 2,
    hint: "Formule o objetivo geral em um verbo no infinitivo (analisar, propor, investigar, caracterizar). Se couber, liste objetivos específicos mensuráveis ou verificáveis.",
    reviewCriteria:
      "Verifique verbo no infinitivo, clareza, viabilidade e alinhamento com o problema. Objetivos devem ser específicos o suficiente para guiar métodos e indicadores de sucesso.",
  },
  {
    key: "problemStatement",
    label: "Problema de pesquisa",
    rows: 3,
    hint: "Delimite a pergunta ou problema central. Indique o que ainda não se sabe ou não se faz bem o suficiente. O problema deve ser pesquisável, não um tema amplo demais.",
    reviewCriteria:
      "O problema deve ser uma questão investigável, delimitada no tempo/espaço/escopo, com lacuna explícita na literatura ou na prática. Evitar temas encyclopédicos ou perguntas fechadas com resposta óbvia.",
  },
  {
    key: "hypothesis",
    label: "Hipotese",
    rows: 2,
    hint: "Se aplicável, declare hipóteses testáveis ou proposições a serem exploradas. Em pesquisa exploratória, descreva expectativas ou relações prováveis entre variáveis/conceitos.",
    reviewCriteria:
      "Hipóteses devem ser falsificáveis ou verificáveis, coerentes com o problema e o referencial. Em estudos qualitativos, avaliar se as proposições são claras e orientam a coleta/análise.",
  },
  {
    key: "methodology",
    label: "Metodologia",
    rows: 4,
    hint: "Descreva abordagem (qualitativa, quantitativa ou mista), tipo de estudo, população/amostra, instrumentos, procedimentos de coleta e análise, e critérios de validade/confiabilidade.",
    reviewCriteria:
      "Avalie coerência entre problema/objetivos e métodos escolhidos, detalhamento de etapas, justificativa da amostra, instrumentos e análise. Identificar lacunas em ética, reprodutibilidade e viabilidade.",
  },
  {
    key: "theoreticalFramework",
    label: "Referencial teorico",
    rows: 3,
    hint: "Apresente autores, teorias e conceitos-chave que fundamentam o estudo. Mostre como o referencial sustenta variáveis, categorias ou argumentos da pesquisa.",
    reviewCriteria:
      "Referencial deve dialogar com o problema, não ser lista de citações. Avaliar atualidade, pertinência, articulação conceitual e ausência de 'decoreba bibliográfica'.",
  },
  {
    key: "academicContribution",
    label: "Contribuicao academica",
    rows: 3,
    hint: "Indique o que o trabalho acrescenta: teoria, método, aplicação, dados, produto ou recomendações. Diferencie contribuição científica de mero relato de atividades.",
    reviewCriteria:
      "Contribuição deve ser original, delimitada e alinhada aos resultados esperados. Avaliar se é incremental, aplicada ou teórica e se está bem justificada.",
  },
  {
    key: "expectedResults",
    label: "Resultado esperado",
    rows: 3,
    hint: "Descreva entregas concretas: artigos, protótipos, datasets, modelos, frameworks, recomendações. Relacione com objetivos e cronograma quando possível.",
    reviewCriteria:
      "Resultados devem ser verificáveis, coerentes com objetivos e metodologia. Avaliar realismo, mensurabilidade e articulação com contribuição acadêmica.",
  },
  {
    key: "limitations",
    label: "Limitacoes",
    rows: 2,
    hint: "Antecipe restrições de escopo, amostra, métodos, recursos ou vieses. Limitações bem descritas fortalecem a credibilidade do projeto.",
    reviewCriteria:
      "Limitações devem ser honestas, específicas e ligadas ao desenho do estudo — não genéricas ('tempo limitado' sem explicar impacto). Avaliar maturidade reflexiva.",
  },
  {
    key: "notes",
    label: "Notas gerais",
    rows: 2,
    hint: "Espaço livre para riscos, dependências, acordos com orientador, etapas futuras ou observações que não couberam nos demais campos.",
    reviewCriteria:
      "Avaliar se as notas agregam informação útil para acompanhamento (cronograma, riscos, pendências) ou são redundantes com outros campos.",
  },
];

export const ACADEMIC_FIELD_MAP = Object.fromEntries(
  ACADEMIC_TEXT_FIELDS.map((f) => [f.key, f]),
) as Record<AcademicReviewFieldKey, AcademicTextFieldDef>;
