export const PROJECT_BUNDLE_FORMAT_VERSION = "1.0";

export const PROJECT_BUNDLE_FORMAT_DOC_TITLE = "Formato JSON de projeto LabFlow";

/**
 * Documentacao do pacote completo de projeto (`kind: "project"`).
 * Usada no conhecimento, no download MD e como referencia para IAs externas.
 */
export const PROJECT_BUNDLE_FORMAT_DOC = `# Formato JSON de projeto LabFlow (v${PROJECT_BUNDLE_FORMAT_VERSION})

Este documento descreve o **pacote completo de projeto** usado para:

1. **Exportar / importar** um projeto entre servidores LabFlow
2. **Criar, melhorar ou complementar** um projeto com IA externa (ChatGPT, Claude, etc.)
3. Preparar um JSON que um administrador importa em **Configuracoes**

> Diferente do *Formato JSON de artefatos* (rascunhos IA parciais), este pacote representa o **projeto inteiro** (metadados, WBS, tarefas, wiki, forum, etc.).

## Cabecalho obrigatorio

\`\`\`json
{
  "version": "${PROJECT_BUNDLE_FORMAT_VERSION}",
  "kind": "project",
  "exportedAt": "2026-07-29T12:00:00.000Z",
  "project": { ... },
  "memberships": [],
  "labels": [],
  "sprints": [],
  "workPackages": [],
  "requirements": [],
  "deliverables": [],
  "systemElements": [],
  "interfaces": [],
  "milestones": [],
  "verificationCases": [],
  "tasks": [],
  "aiDrafts": [],
  "knowledgeArticles": [],
  "pluginSettings": [],
  "channels": [],
  "feedbacks": []
}
\`\`\`

| Campo | Tipo | Obrigatorio | Notas |
|-------|------|-------------|-------|
| version | string | sim | Sempre \`"1.0"\` |
| kind | string | sim | Sempre \`"project"\` |
| exportedAt | string | sim | ISO-8601 |
| project | object | sim | Metadados do projeto (\`key\` e \`name\` obrigatorios) |

Arrays ausentes sao tratados como vazios na importacao. Inclua pelo menos \`[]\` nos blocos que a IA deve preencher.

## Referencias internas (\`_ref\`)

Varias entidades usam \`_ref\` (string opaca, ex.: \`"wp-1"\`, \`"req-sys-001"\`).

- Serve **apenas dentro do JSON** para ligar pais/filhos e rastros
- Nao precisa ser um ID real do banco
- Campos \`*Ref\` / \`*Refs\` apontam para o \`_ref\` de outra entidade do mesmo arquivo
- Em importacao, o LabFlow gera novos IDs e remapeia as ligacoes

Exemplo: tarefa aponta para pacote e sprint:

\`\`\`json
{
  "_ref": "task-1",
  "title": "Calibrar sensores",
  "workPackageRef": "wp-hardware",
  "sprintRef": "sprint-1"
}
\`\`\`

## Usuarios (e-mails)

Membros, autores, assignees e feedbacks sao referenciados por **e-mail**.

- No destino, o usuario **ja deve existir** (importe usuarios antes, se necessario)
- E-mails desconhecidos geram **aviso** e o vinculo e ignorado
- Preferivel usar e-mails reais do laboratorio

---

## \`project\` (metadados)

| Campo | Tipo | Obrigatorio | Valores / formato |
|-------|------|-------------|-------------------|
| key | string | sim | Sigla unica, tipicamente MAIUSCULA (ex.: \`EEG\`) |
| name | string | sim | Nome legivel |
| description | string\\|null | nao | Resumo do projeto |
| color | string | nao | Hex, ex.: \`#6366f1\` |
| status | string | nao | \`active\`, \`paused\`, \`archived\` |
| projectKind | string | nao | \`lab\`, \`admin\`, \`thesis\`, \`dissertation\`, \`paper\` |
| featuresJson | string | nao | **String JSON** com flags de modulos |
| academicJson | string | nao | **String JSON** (tese/dissertacao) |
| paperJson | string | nao | **String JSON** (artigo) |
| conops | string | nao | **String JSON** do CONOPS |

### Importante: campos JSON aninhados sao *strings*

\`conops\`, \`featuresJson\`, \`academicJson\` e \`paperJson\` sao armazenados como **texto JSON** (string), nao como objetos aninhados no pacote.

Correto:

\`\`\`json
"conops": "{\\"mission\\":\\"Registrar sinais EEG\\",\\"scope\\":\\"...\\",\\"stakeholders\\":\\"\\",\\"operatingEnvironment\\":\\"\\",\\"conceptOfOperations\\":\\"\\",\\"constraints\\":\\"\\",\\"successCriteria\\":\\"\\",\\"assumptions\\":\\"\\"}"
\`\`\`

Ao montar o arquivo com codigo, use \`JSON.stringify(objeto)\` nesses campos.

### CONOPS (conteudo interno de \`conops\`)

| Campo | Descricao |
|-------|-----------|
| mission | Objetivo / missao |
| scope | Escopo (dentro/fora) |
| stakeholders | Interessados |
| operatingEnvironment | Ambiente operacional |
| conceptOfOperations | Como o sistema e usado |
| constraints | Restricoes |
| successCriteria | Criterios de sucesso |
| assumptions | Premissas |

### \`featuresJson\` (modulos)

Objeto com booleanos. Chaves conhecidas:

\`wbs\`, \`requirements\`, \`deliverables\`, \`sprints\`, \`roadmap\`, \`systemModel\`, \`verification\`, \`conops\`, \`board\`, \`knowledge\`, \`forum\`, \`methodology\`, \`courses\`, \`paperPipeline\`

Exemplo (projeto de laboratorio):

\`\`\`json
{
  "wbs": true,
  "requirements": true,
  "deliverables": true,
  "sprints": true,
  "roadmap": true,
  "systemModel": true,
  "verification": true,
  "conops": true,
  "board": true,
  "knowledge": true,
  "forum": true,
  "methodology": false,
  "courses": false,
  "paperPipeline": false
}
\`\`\`

### \`academicJson\` (thesis / dissertation)

Campos principais: \`motivation\`, \`objective\`, \`problemStatement\`, \`hypothesis\`, \`methodology\`, \`theoreticalFramework\`, \`academicContribution\`, \`expectedResults\`, \`limitations\`, \`notes\`, \`advisorName\`, \`coAdvisorName\`, \`startDate\`, \`expectedDefenseDate\` (ISO ou null), \`courses\` (array), \`pending\` (array).

Curso: \`{ "code", "name", "status", "grade?" }\`.  
Pendencia: \`{ "title", "kind", "dueDate?", "status" }\`.

### \`paperJson\` (paper)

Campos: \`abstract\`, \`venue\`, \`venueType\` (\`journal\`\\| \`conference\`\\| \`preprint\`\\| \`thesis_chapter\`\\| \`other\`\\| \`""\`), \`status\` (\`idea\`, \`scoping\`, \`drafting\`, \`internal_review\`, \`submitted\`, \`under_review\`, \`revision\`, \`accepted\`, \`published\`), \`targetDate\`, \`publishedAt\`, \`doi\`, \`externalEditorUrl\`, mais campos de metodologia semelhantes ao academico.

---

## \`memberships\`

| Campo | Tipo | Valores |
|-------|------|---------|
| email | string | E-mail do usuario |
| role | string | \`lead\`, \`contributor\`, \`viewer\`, \`advisor\` (tese), \`coauthor\` (artigo) |

---

## \`labels\`

| Campo | Tipo |
|-------|------|
| name | string |
| color | string (hex) |

---

## \`sprints\`

| Campo | Tipo | Valores |
|-------|------|---------|
| _ref | string | Referencia interna |
| name | string | Obrigatorio |
| goal | string\\|null | |
| startDate / endDate | string\\|null | ISO-8601 |
| status | string | Ex.: \`planned\`, \`active\`, \`closed\` |

---

## \`workPackages\` (WBS)

| Campo | Tipo | Notas |
|-------|------|-------|
| _ref | string | |
| code | string\\|null | Ex.: \`1.2\` |
| name | string | Obrigatorio |
| description | string\\|null | |
| status | string | Ex.: \`planned\`, \`in_progress\`, \`done\` |
| order | number | Ordem de exibicao |
| parentRef | string\\|null | \`_ref\` do pacote pai |

---

## \`requirements\`

| Campo | Tipo | Valores tipicos |
|-------|------|-----------------|
| _ref | string | |
| code | string\\|null | Ex.: \`SYS-001\` |
| title | string | Obrigatorio |
| description | string\\|null | |
| level | string | \`stakeholder\`, \`system\`, \`subsystem\`, \`component\`, \`derived\` |
| source | string\\|null | Origem |
| kind | string | \`goal\`, \`functional\`, \`nonfunctional\`, \`constraint\` |
| priority | string | \`low\`, \`medium\`, \`high\` |
| status | string | \`proposed\`, \`approved\`, \`implemented\`, \`verified\` |
| parentRef | string\\|null | Requisito pai |
| allocatedToRef | string\\|null | \`_ref\` de systemElement |
| deliverableRefs | string[] | \`_ref\`s de deliverables |
| activityRefs | string[] | \`_ref\`s de workPackages |

---

## \`deliverables\`

| Campo | Tipo |
|-------|------|
| _ref | string |
| name | string |
| description | string\\|null |
| acceptance | string\\|null | Criterios de aceite |
| status | string | Ex.: \`planned\`, \`in_progress\`, \`delivered\`, \`accepted\`, \`rejected\` |
| dueDate | string\\|null | ISO-8601 |
| workPackageRef | string\\|null | |

---

## \`systemElements\` e \`interfaces\`

**Elemento:** \`name\`, \`kind\` (\`system\`, \`subsystem\`, \`component\`, \`external\`), \`description\`, \`diagram\`, \`order\`, \`parentRef\`.

**Interface:** \`name\`, \`kind\`, \`protocol\`, \`fromRef\`, \`toRef\` (obrigatorios — \`_ref\` de systemElements).

---

## \`milestones\`

| Campo | Valores tipicos |
|-------|-----------------|
| name | Obrigatorio |
| gate | \`SRR\`, \`PDR\`, \`CDR\`, \`TRR\`, \`FRR\` (ou null) |
| kind | Ex.: \`milestone\`, \`verification\` |
| date | ISO-8601 ou null |
| status | Ex.: \`upcoming\`, \`done\` |

---

## \`verificationCases\`

| Campo | Notas |
|-------|-------|
| name | Obrigatorio |
| method | \`test\`, \`analysis\`, \`inspection\`, \`demonstration\`, \`simulation\` |
| status | Ex.: \`planned\`, \`passed\`, \`failed\` |
| result / evidence | Texto livre |
| requirementRef | **Obrigatorio** na importacao — \`_ref\` de requirement |
| milestoneRef | Opcional |

Casos sem requisito resolvido sao **ignorados** (com aviso).

---

## \`tasks\`

| Campo | Tipo / valores |
|-------|----------------|
| title | obrigatorio |
| description | string\\|null (pode conter checklist Markdown) |
| status | \`backlog\`, \`todo\`, \`in_progress\`, \`review\`, \`done\` (ou colunas customizadas do projeto) |
| priority | \`low\`, \`medium\`, \`high\`, \`urgent\` |
| estimate | number\\|null (horas) |
| startDate / dueDate | ISO-8601 ou null |
| order | number |
| workPackageRef / sprintRef | \`_ref\` ou null |
| creatorEmail | string\\|null |
| assigneeEmails | string[] |
| labelNames | string[] (devem existir em \`labels\`) |
| comments | \`{ authorEmail, content, createdAt }[]\` |

---

## \`aiDrafts\`

Rascunhos de artefatos gerados por IA (ainda nao aceitos).

| Campo | Notas |
|-------|-------|
| artifactType | \`requirement\`, \`task\`, \`deliverable\`, \`work_package\`, \`milestone\`, \`system_element\`, \`verification_case\`, \`sprint_plan\` |
| title | string |
| payload | **String JSON** do artefato |
| source | Ex.: \`import\`, \`conops\`, \`manual\` |
| status | \`pending\`, \`accepted\`, \`rejected\` |

Para **criar conteudo novo com IA externa**, em geral e melhor preencher as listas reais (\`requirements\`, \`tasks\`, …) em vez de \`aiDrafts\`.

---

## \`knowledgeArticles\`

| Campo | Notas |
|-------|-------|
| title / content | Markdown no \`content\` |
| tags | string (csv) |
| authorEmail | string\\|null |
| links | \`{ targetType, targetRef }\` — \`targetType\`: \`task\`, \`deliverable\`, \`requirement\`, etc. |
| external* | Campos Nextcloud; deixe null se wiki local |

---

## \`pluginSettings\`

\`{ "pluginId": "board", "settings": "<string JSON>" }\`

Ex.: colunas do Kanban no plugin \`board\`.

---

## \`channels\` (forum)

Canal → threads → posts. Autores por e-mail. \`status\` da thread tipicamente \`open\` / \`closed\`; \`pinned\` boolean.

---

## \`feedbacks\`

| Campo | Valores |
|-------|---------|
| title / description | |
| category | Ex.: \`bug\`, \`suggestion\` |
| status | Ex.: \`open\`, \`in_progress\`, \`done\` |
| submittedByEmail | obrigatorio (usuario deve existir) |
| assigneeEmail | opcional |
| linkedDrafts | string JSON |
| platformUrl | string\\|null |

---

## Exemplo minimo (criar projeto com IA)

\`\`\`json
{
  "version": "1.0",
  "kind": "project",
  "exportedAt": "2026-07-29T12:00:00.000Z",
  "project": {
    "key": "EEG",
    "name": "Pipeline de aquisicao EEG",
    "description": "Sistema de captura e analise de sinais EEG.",
    "color": "#0ea5e9",
    "status": "active",
    "projectKind": "lab",
    "featuresJson": "{\\"wbs\\":true,\\"requirements\\":true,\\"deliverables\\":true,\\"sprints\\":true,\\"roadmap\\":true,\\"systemModel\\":true,\\"verification\\":true,\\"conops\\":true,\\"board\\":true,\\"knowledge\\":true,\\"forum\\":true,\\"methodology\\":false,\\"courses\\":false,\\"paperPipeline\\":false}",
    "academicJson": "{}",
    "paperJson": "{}",
    "conops": "{\\"mission\\":\\"Capturar EEG com qualidade clinica\\",\\"scope\\":\\"Hardware + firmware + pipeline offline\\",\\"stakeholders\\":\\"Pesquisadores, engenharia, etica\\",\\"operatingEnvironment\\":\\"Laboratorio controlado\\",\\"conceptOfOperations\\":\\"Sessao de gravacao → processamento → relatorio\\",\\"constraints\\":\\"LGPD; amostragem >= 256 Hz\\",\\"successCriteria\\":\\"Sinal utilizavel em 95% das sessoes\\",\\"assumptions\\":\\"Voluntarios consentidos\\"}"
  },
  "memberships": [
    { "email": "lead@lab.edu", "role": "lead" }
  ],
  "labels": [
    { "name": "hardware", "color": "#f59e0b" }
  ],
  "sprints": [
    {
      "_ref": "s1",
      "name": "Sprint 1 — Fundacao",
      "goal": "Montar banco e aquisicao basica",
      "startDate": null,
      "endDate": null,
      "status": "planned"
    }
  ],
  "workPackages": [
    {
      "_ref": "wp1",
      "code": "1",
      "name": "Aquisicao",
      "description": "Cadeia de captura",
      "status": "planned",
      "order": 0,
      "parentRef": null
    }
  ],
  "requirements": [
    {
      "_ref": "r1",
      "code": "SYS-001",
      "title": "Amostragem minima 256 Hz",
      "description": "Taxa para analise espectral",
      "level": "system",
      "source": null,
      "kind": "functional",
      "priority": "high",
      "status": "proposed",
      "parentRef": null,
      "allocatedToRef": null,
      "deliverableRefs": [],
      "activityRefs": ["wp1"]
    }
  ],
  "deliverables": [],
  "systemElements": [],
  "interfaces": [],
  "milestones": [],
  "verificationCases": [],
  "tasks": [
    {
      "_ref": "t1",
      "title": "Definir protocolo de eletrodos",
      "description": null,
      "status": "backlog",
      "priority": "high",
      "estimate": 4,
      "startDate": null,
      "dueDate": null,
      "order": 0,
      "workPackageRef": "wp1",
      "sprintRef": "s1",
      "creatorEmail": null,
      "assigneeEmails": [],
      "labelNames": ["hardware"],
      "comments": []
    }
  ],
  "aiDrafts": [],
  "knowledgeArticles": [],
  "pluginSettings": [],
  "channels": [],
  "feedbacks": []
}
\`\`\`

---

## Prompt sugerido para IA externa

> Voce e um engenheiro de sistemas / gestor de pesquisa. Gere um unico JSON valido no **Formato JSON de projeto LabFlow v1.0** (\`kind: "project"\`).
>
> Regras:
> - \`version\` = \`"1.0"\`, \`kind\` = \`"project"\`
> - Use \`_ref\` estaveis e ligue entidades com \`*Ref\` / \`*Refs\`
> - \`conops\`, \`featuresJson\`, \`academicJson\` e \`paperJson\` devem ser **strings JSON** (stringify)
> - Preencha arrays relevantes ao tipo de projeto (\`projectKind\`)
> - Nao invente e-mails de pessoas reais; use placeholders claros (ex.: \`lead@lab.edu\`) ou omita memberships
> - Responda **somente** com o JSON, sem markdown
>
> Contexto do projeto: [cole descricao / CONOPS / trechos atuais]

Para **complementar** um projeto existente: exporte o pacote no LabFlow, envie o JSON + este documento a IA pedindo apenas adicoes (novas tarefas, requisitos, etc.) mantendo \`_ref\`s existentes intactos, e depois mescle / importe conforme o fluxo do laboratorio (importacao cria projeto **novo**; nao sobrescreve um existente com a mesma \`key\`).

## Fluxo no LabFlow

1. **Baixar pacote:** Projeto → Configuracoes → *Baixar pacote completo*
2. **Baixar este guia:** mesmo painel → *Baixar guia do formato (MD)*
3. **Importar:** apenas **admin** em Configuracoes (cria projeto novo; \`key\` nao pode ja existir)
4. Artigo espelho na base de conhecimento: **Formato JSON de projeto LabFlow**

## Relacao com artefatos

| Formato | Uso |
|---------|-----|
| Artefatos v1.0 | Importa como **rascunhos IA** (revisao/aceite) |
| Projeto v1.0 (este) | Cria o **projeto completo** no banco |

Use artefatos para iterar com CONOPS / Gerar com IA. Use o pacote de projeto para migracao ou bootstrap estruturado por IA externa.
`;
