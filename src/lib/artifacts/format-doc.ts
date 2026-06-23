import "server-only";

export const ARTIFACTS_FORMAT_DOC = `# Formato JSON de artefatos LabFlow (v1.0)

Este documento descreve o padrao para **exportar**, **importar** e **gerar com IA externa** artefatos de projetos no LabFlow.

## Estrutura do arquivo

\`\`\`json
{
  "version": "1.0",
  "projectKey": "EEG",
  "projectName": "Projeto EEG",
  "exportedAt": "2026-06-23T12:00:00.000Z",
  "conops": {
    "mission": "Objetivo do projeto",
    "scope": "O que esta dentro e fora do escopo",
    "stakeholders": "Quem sao os interessados",
    "operatingEnvironment": "Onde e como o sistema opera",
    "conceptOfOperations": "Como o sistema sera usado no dia a dia",
    "constraints": "Restricoes tecnicas, legais, prazo",
    "successCriteria": "Como saber que deu certo",
    "assumptions": "Premissas assumidas"
  },
  "requirements": [],
  "tasks": [],
  "deliverables": [],
  "workPackages": [],
  "milestones": [],
  "systemElements": [],
  "verificationCases": []
}
\`\`\`

## Requisitos (\`requirements\`)

| Campo | Tipo | Obrigatorio | Valores |
|-------|------|-------------|---------|
| code | string | nao | Ex: SN-001, SYS-001 |
| title | string | sim | Titulo do requisito |
| description | string | nao | Detalhamento |
| level | string | nao | stakeholder, system, subsystem, component, derived |
| kind | string | nao | goal, functional, nonfunctional, constraint |
| priority | string | nao | low, medium, high |
| status | string | nao | proposed, approved, implemented, verified |

Exemplo:
\`\`\`json
{
  "code": "SYS-001",
  "title": "O sistema deve registrar sinais EEG a 256 Hz",
  "description": "Taxa de amostragem minima para analise espectral",
  "level": "system",
  "kind": "functional",
  "priority": "high"
}
\`\`\`

## Tarefas (\`tasks\`)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| title | string | sim |
| description | string | nao |
| status | string | nao (backlog, todo, in_progress, review, done) |
| priority | string | nao (low, medium, high, urgent) |

## Entregaveis (\`deliverables\`)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| name | string | sim |
| description | string | nao |
| acceptance | string | nao |
| status | string | nao |
| dueDate | string | nao (YYYY-MM-DD) |

## Atividades WBS (\`workPackages\`)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| code | string | nao |
| name | string | sim |
| description | string | nao |
| status | string | nao |

## Marcos (\`milestones\`)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| name | string | sim |
| gate | string | nao (SRR, PDR, CDR, TRR, FRR) |
| kind | string | nao |
| date | string | nao (YYYY-MM-DD) |

## Elementos do sistema (\`systemElements\`)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| name | string | sim |
| kind | string | nao (system, subsystem, component, external) |
| description | string | nao |

## Casos V&V (\`verificationCases\`)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| name | string | sim |
| method | string | nao (test, analysis, inspection, demonstration, simulation) |
| requirementCode | string | nao | Codigo do requisito vinculado |

## Fluxo no LabFlow

1. Preencha o **CONOPS** na pagina do projeto
2. Clique **Gerar com IA** ou importe um JSON
3. Artefatos entram como **rascunhos IA** (badge laranja)
4. **Aceitar** cria o artefato real | **Rejeitar** descarta | **Editar** o JSON do rascunho

## Uso com IA externa (ChatGPT, Claude, etc.)

Prompt sugerido:

> Gere um JSON no formato LabFlow v1.0 para um projeto de [descricao]. Inclua requirements, tasks, deliverables e workPackages. Siga o schema do documento de formato LabFlow.

Cole o JSON em **Importar artefatos** na pagina do projeto.

## Exportar

Na pagina do projeto: **Exportar JSON** baixa todos os artefatos atuais neste formato.
`;
