/** Base consolidada de Metodologia Científica para avaliação por IA. */

export const METHODOLOGY_KNOWLEDGE_BASE = `# Metodologia Científica — Referência para Pesquisa Acadêmica

## 1. Princípios do método científico
- **Objetividade:** separar observação de opinião; evidências verificáveis.
- **Rigor:** procedimentos explícitos, replicáveis ou auditáveis.
- **Sistematicidade:** etapas encadeadas (problema → objetivos → métodos → análise → conclusões).
- **Falsificabilidade / verificabilidade:** hipóteses e proposições devem permitir teste ou exame empírico/teórico.
- **Ética:** integridade, consentimento, confidencialidade, uso responsável de dados.

## 2. Estrutura lógica de um projeto de pesquisa
1. **Contextualização e motivação** — por que investigar agora?
2. **Problema de pesquisa** — qual lacuna ou questão central?
3. **Objetivos** — o que se pretende alcançar (geral + específicos).
4. **Justificativa / relevância** — contribuição esperada.
5. **Referencial teórico** — conceitos, teorias e debates que fundamentam.
6. **Hipóteses ou questões de pesquisa** — proposições orientadoras.
7. **Metodologia** — como investigar (desenho, amostra, coleta, análise).
8. **Resultados esperados** — entregas concretas.
9. **Limitações** — fronteiras e restrições do estudo.

## 3. Problema de pesquisa
- Deve ser **investigável** (não um tema, mas uma questão).
- Deve indicar **lacuna** (o que falta saber, medir, comparar ou explicar).
- Deve ser **delimitado** (escopo temporal, espacial, populacional ou técnico).
- Erros comuns: tema amplo demais; pergunta fechada com resposta trivial; confundir problema com solução.

## 4. Objetivos
- Objetivo **geral**: um verbo no infinitivo + objeto + contexto (ex.: "Analisar os fatores que influenciam X em Y").
- Objetivos **específicos**: decompõem o geral em etapas verificáveis.
- Devem ser **coerentes** com problema, métodos e resultados.
- Erros: objetivos que descrevem atividades ("ler artigos") em vez de metas investigativas.

## 5. Hipóteses e questões
- **Quantitativa:** hipóteses testáveis com variáveis e relação direcional ou de associação.
- **Qualitativa:** questões de pesquisa ou proposições exploratórias bem delimitadas.
- Devem derivar do referencial e apontar para métodos adequados.

## 6. Referencial teórico
- Função: **fundamentar conceitos**, não apenas listar autores.
- Deve articular teorias com o problema e as categorias de análise.
- Priorizar fontes **primárias**, atualizadas e pertinentes ao escopo.
- Evitar "decoreba": cada referência deve ter papel claro no argumento.

## 7. Metodologia
### 7.1 Abordagens
- **Quantitativa:** medição, estatística, generalização controlada.
- **Qualitativa:** significados, contexto, processos, análise interpretativa.
- **Mista / multimétodos:** integração deliberada com justificativa.

### 7.2 Elementos mínimos a descrever
- Tipo de estudo (experimental, survey, estudo de caso, revisão sistemática, etc.).
- População e amostra (critérios de inclusão/exclusão).
- Instrumentos (questionários, entrevistas, protocolos, bases de dados).
- Procedimentos de coleta e análise (incluindo software ou framework analítico).
- Critérios de **validade** (interna, externa, de constructo) e **confiabilidade**.
- Aspectos éticos (comitê, consentimento, anonimização).

## 8. Contribuição acadêmica
- **Teórica:** novos modelos, refinamento conceitual, síntese crítica.
- **Metodológica:** novos instrumentos, protocolos, pipelines.
- **Aplicada:** soluções, políticas, produtos, recomendações baseadas em evidência.
- Deve ser **defensável** frente ao estado da arte descrito no referencial.

## 9. Resultados esperados
- Artefatos verificáveis: artigos, dissertação/tese, datasets, software, protótipos.
- Indicadores de sucesso alinhados aos objetivos.
- Realismo frente ao cronograma e recursos do programa (mestrado/doutorado/IC).

## 10. Limitações
- Escopo, viés de amostra, restrições de métodos, acesso a dados, generalização.
- Boa limitação explica **impacto** na validade ou aplicabilidade dos achados.

## 11. Coerência transversal (checklist)
- Motivação → problema → objetivos → hipóteses/questões → métodos → resultados.
- Referencial sustenta conceitos usados na metodologia e na discussão.
- Contribuição prometida é alcançável com o desenho proposto.
- Limitações reconhecem fragilidades reais do desenho.

## 12. Programas de pós-graduação (orientações gerais)
- **Mestrado:** originalidade incremental, domínio metodológico, produção científica inicial.
- **Doutorado:** contribuição significativa, profundidade teórica/metodológica, consistência argumentativa.
- **IC / graduação:** clareza de aprendizado, rigor proporcional, delimitação forte.
- **Pós-doc:** articulação com linha de pesquisa do grupo e projetos em andamento.
`;

export const METHODOLOGY_ARTICLE_TITLE = "Metodologia Cientifica — Guia para Pesquisa Academica";

export function methodologyArticleContent(): string {
  return `# ${METHODOLOGY_ARTICLE_TITLE}

${METHODOLOGY_INTRO_FROM_KB()}

${METHODOLOGY_KNOWLEDGE_BASE}

## Instruções por campo do acompanhamento acadêmico

${FIELD_INSTRUCTIONS_FOR_ARTICLE()}
`;
}

function METHODOLOGY_INTRO_FROM_KB(): string {
  return `Este guia consolida princípios de metodologia científica para apoiar alunos de mestrado, doutorado e iniciação científica no preenchimento do perfil acadêmico do LabFlow e na avaliação assistida por IA.`;
}

function FIELD_INSTRUCTIONS_FOR_ARTICLE(): string {
  // Lazy import avoided — duplicate minimal list inline for article
  return [
    "- **Motivação:** relevância e contexto da investigação.",
    "- **Objetivo:** verbo no infinitivo, metas verificáveis.",
    "- **Problema:** questão investigável e delimitada.",
    "- **Hipótese:** proposições testáveis ou exploratórias claras.",
    "- **Metodologia:** desenho, amostra, coleta, análise, ética.",
    "- **Referencial teórico:** fundamentação conceitual articulada.",
    "- **Contribuição acadêmica:** originalidade e valor científico.",
    "- **Resultados esperados:** entregas concretas e realistas.",
    "- **Limitações:** restrições específicas do estudo.",
  ].join("\n");
}
