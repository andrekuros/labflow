# LabFlow — Guia para Agentes de IA

Plataforma **self-hosted** de gestão de laboratório de pesquisa (Next.js 15 App Router, Prisma, SQLite/PostgreSQL).
Este é o **ponto de entrada canônico para agentes de IA**. Leia esta página inteira antes de editar código.

| Quero… | Vá para |
|--------|---------|
| Entender a arquitetura em profundidade (diagramas, fluxos) | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Instalar, configurar `.env`, rodar | [README.md](README.md) |
| Prompts e workflow em Cursor / Claude Code | [docs/CURSOR.md](docs/CURSOR.md) |
| Criar um plugin passo a passo | `.cursor/skills/labflow-plugin/` |
| Mexer em RAG / assistente / embeddings | `.cursor/skills/labflow-ai/` |

---

## 1. Modelo mental em 60 segundos

**Tudo é plugin.** Não existe "core de features": cada módulo do produto (Kanban, Projetos, Biblioteca, Relatórios…) é um plugin em `src/plugins/<id>/` que declara um `PluginManifest`. O núcleo (`src/lib/`, `src/plugins/registry.ts`, `src/server/bootstrap.ts`) só sabe carregar manifests, resolver permissões, rotear API e distribuir eventos.

Quatro eixos sustentam a plataforma:

1. **Registry de plugins** — manifests declaram nav, settings, rotas REST, ferramentas de IA e slots de UI.
2. **Event bus in-process** (`src/lib/events.ts`) — mutações emitem eventos; RAG, activity log e agentes reagem sem acoplamento.
3. **RBAC por chave** (`src/lib/rbac.ts`) — permissões `modulo:acao` persistidas no banco, nunca roles hardcoded (exceto `admin`).
4. **Escopo de workspace** (`src/lib/workspace.ts`) — os filtros de contexto da topbar resolvem um conjunto de `projectIds` que **toda** agregação precisa respeitar.

Consequência prática: **para adicionar uma feature, quase sempre você edita um plugin — não o núcleo.**

---

## 2. Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15 App Router, React 19, Tailwind 3, Lucide |
| Backend | Server Actions + Route Handlers, Prisma ORM 6 |
| Banco | SQLite (dev) / PostgreSQL (prod) — 40 models em `prisma/schema.prisma` |
| Auth | JWT em cookie httpOnly (`jose` + `bcryptjs`) — **sem middleware**, a proteção vive no layout |
| IA | OpenAI / Ollama / offline + RAG com embeddings em JSON |
| Extensibilidade | Registry de plugins + event bus in-process |

Sem framework de testes no repositório e **sem configuração de ESLint** (`npm run lint` abre um
prompt interativo e não valida nada). **O portão de qualidade real é `npm run typecheck`**, com
`npm run build` para validar o grafo completo.

---

## 3. Estrutura de pastas

```
labflow/
├── AGENTS.md                 ← este arquivo (entrada para IA)
├── CLAUDE.md                 ← ponteiro para este arquivo
├── README.md                 ← guia humano (instalação, uso)
├── docs/
│   ├── ARCHITECTURE.md       ← visão geral com diagramas e fluxos
│   └── CURSOR.md             ← workflow com agentes de IA
├── .cursor/rules/            ← regras persistentes do Cursor (.mdc)
├── .cursor/skills/           ← skills: labflow-dev, labflow-plugin, labflow-ai
├── prisma/
│   ├── schema.prisma         ← modelo de dados
│   └── seed.ts               ← dados de demonstração
├── scripts/                  ← utilitários de manutenção
└── src/
    ├── app/
    │   ├── (app)/            ← páginas autenticadas — thin wrappers do plugin page
    │   ├── actions/          ← server actions globais (auth, settings, users, backup…)
    │   ├── api/              ← route handlers (/api/v1/*, backup, knowledge/file)
    │   └── login/            ← tela pública de login
    ├── components/           ← UI React (um diretório por módulo + ui/ compartilhado)
    ├── lib/                  ← auth, rbac, eventos, IA, conhecimento, projetos, SE
    ├── plugins/              ← módulos + registry + contrato + auth da API
    └── server/bootstrap.ts   ← wiring de eventos, plugins e schedulers
```

**Regra de ouro do layout:** um plugin quase nunca tem componentes client dentro de `src/plugins/`. Server components ficam em `src/plugins/<id>/page.tsx`; client components ficam em `src/components/<modulo>/`.

---

## 4. Plugins registrados

Registro em [`src/plugins/index.ts`](src/plugins/index.ts) (`BUILTIN_PLUGINS` + `API_REGISTRATIONS`). Contrato em [`src/plugins/types.ts`](src/plugins/types.ts).

| Plugin ID | Rota | Nav (label · grupo · ordem) | `requires` |
|-----------|------|------------------------------|------------|
| `board` | `/board` | Kanban · Trabalho · 10 | `projects` |
| `projects` | `/projects` | Projetos · Trabalho · 20 | — |
| `planning` | `/planning` | Planejamento · Trabalho · 35 | `projects` |
| `gantt` | `/gantt` | Gantt · Planejamento · 40 | `projects` |
| `system-model` | `/system-model` | Modelo SE · Planejamento · 45 | `projects` |
| `verification` | `/verification` | V&V · Planejamento · 55 | `requirements` |
| `knowledge` | `/knowledge` | Biblioteca · Conhecimento · 70 | — |
| `repository` | `/repository` | Repositorio · Conhecimento · 72 | — |
| `forum` | `/forum` | Fóruns · Conhecimento · 80 | `projects` |
| `assistant` | `/assistant` | Assistente IA · Conhecimento · 85 | `knowledge` |
| `reports` | `/reports` | Relatórios · Gestão · 80 | `projects` |
| `feedback` | `/feedback` | Demandas · Administração · 82 | — |
| `activity-log` | `/activity-log` | Atividades · Administração · 86 | — |
| `team` | `/team` | Equipe · Administração · 90 | — |
| `sprints` | `/sprints` | **sem nav** — consolidado em `/planning` | `projects` |
| `roadmap` | `/roadmap` | **sem nav** — consolidado em `/planning` | `projects`, `sprints` |
| `deliverables` | `/deliverables` | **sem nav** — consolidado em `/planning` | `projects` |
| `requirements` | `/requirements` | **sem nav** — consolidado em `/planning` | `projects` |
| `thesis` | `/thesis` | **sem nav** — acessado via projetos | `projects` |
| `papers` | `/papers` | **sem nav** — acessado via projetos | `projects`, `knowledge` |
| `labflow.example-task-assistant` | — | — | — |

**Rotas legadas:** `/academic` → redirect `/thesis`; `/publications` → redirect `/papers`.

> ⚠️ `src/plugins/academic/` existe no disco (manifest, actions, api, page) mas **não está em `BUILTIN_PLUGINS`**. O comentário no manifest diz "kept registered without nav" — isso não é mais verdade. Consequência: `/api/v1/academic/*` responde 404. Trate como código legado; não presuma que está ativo.

### Visibilidade do nav

`getNavItems()` devolve os itens dos plugins habilitados; **[`src/lib/nav-visibility.ts`](src/lib/nav-visibility.ts)** (`visibleNavItems`) aplica três filtros depois:

1. itens com permissão exigida: `activity-log` → `activity_log:view`, `repository` → `repository:view` (mapa `PERMISSION_GATED`);
2. no modo "foco em projeto", plugins de features desligadas no projeto somem (mapa `FEATURE_TO_PLUGIN`);
3. lista fixa de ocultos: `academic`, `publications`, `thesis`, `papers`.

Esses filtros viviam inline no layout; agora `src/app/(app)/layout.tsx` **e** `GET /api/v1/me` chamam a mesma função — uma UI externa recebe exatamente o menu que o app mostra. Se um item "não aparece", olhe aqui antes de suspeitar do manifest.

### Anatomia de um plugin

| Arquivo | Papel | Obrigatório |
|---------|-------|-------------|
| `src/plugins/<id>/manifest.ts` | `PluginManifest`: id, nav, settings, requires, aiTools, subscriptions, ui | ✅ |
| `src/plugins/<id>/actions.ts` | Server actions (`"use server"`) — lógica de negócio | comum |
| `src/plugins/<id>/page.tsx` | Server component que busca dados | comum |
| `src/plugins/<id>/api.ts` | Handlers REST exportados como `handlers` | opcional |
| `src/components/<modulo>/` | Client components interativos | comum |
| `src/app/(app)/<rota>/page.tsx` | `export { default } from "@/plugins/<id>/page"` | se tem rota |

Checklist de registro: manifest em `BUILTIN_PLUGINS` → handlers em `API_REGISTRATIONS` → ícone Lucide em [`src/plugins/nav-icons.tsx`](src/plugins/nav-icons.tsx) → permissões em [`src/lib/permissions-seed.ts`](src/lib/permissions-seed.ts).

### Pontos de extensão do manifest

| Campo | Efeito |
|-------|--------|
| `nav` | Item na sidebar (`label`, `href`, `icon`, `order`, `group`) |
| `settingsSchema` / `defaultSettings` | Formulário em Configurações; valores lidos com `getPluginSettings(id)` |
| `apiPrefix` | Prefixo documentado no catálogo `GET /api/v1` |
| `subscriptions` | Reage a eventos de domínio |
| `aiTools` | Funções que o agente realmente executa. `kind: "read" \| "propose"` — ver §7 |
| `ui` | Componente em um slot: `dashboard.widgets`, `sidebar.nav`, `project.tabs`, `task.panel` |
| `lifecycle` | `onBoot`, `onEnable`, `onDisable`, `onSettingsChange` |

Referência viva dos pontos de extensão: [`src/plugins/example/index.ts`](src/plugins/example/index.ts) — `aiTools` (`list_projects` + `propose_task`) e `subscriptions`. O `ui` daquele plugin **não é registrado**: o widget listava os nomes das ferramentas de IA no dashboard, o que é diagnóstico de desenvolvimento e não conteúdo de produto. A implementação de referência do slot continua em [`src/plugins/example/widget.tsx`](src/plugins/example/widget.tsx), com instruções para remontá-la.

---

## 5. Event bus

[`src/lib/events.ts`](src/lib/events.ts) — pub/sub in-process. `emit()` **persiste em `ActivityLog`** (best-effort) e depois notifica subscribers.

Tipos disponíveis (`DomainEventType`):

```
task.created | task.updated | task.moved
deliverable.created | deliverable.updated | requirement.created
article.created | article.updated | article.deleted
thread.created | post.created | comment.created
project.created | project.updated
user.created | user.updated
academic.updated | publication.created | publication.updated
feedback.submitted | sprint.created | report.weekly_sent
repository.record_created | repository.record_updated
repository.record_published | repository.record_deleted
```

Após toda mutação relevante:

```typescript
await emit({ type: "task.created", actorId: user.id, projectId, targetId: task.id, payload: { id: task.id, title } });
```

Subscribers vivem em [`src/server/bootstrap.ts`](src/server/bootstrap.ts): ingestão RAG, indexação de tarefas/projetos/usuários, agente de feedback, criação de vault Nextcloud.

**Novo tipo de evento:** adicione em `DomainEventType` **e** registre o subscriber em `bootstrap.ts` se precisar indexar.

---

## 5b. Escopo de workspace — leia antes de somar qualquer número

Os toggles de contexto na topbar (acadêmicos / publicações / desenvolvimento / admin) não são
enfeite: eles definem **quais projetos existem** para a pessoa naquele momento.

```typescript
const scope = await resolveWorkspaceScope(user);
// scope.projectIds        → projetos visíveis E dentro do filtro
// scope.visibleProjectIds → tudo o que a pessoa pode ver, ignorando o filtro
// scope.focused           → o filtro realmente estreita o laboratório?
// scope.label             → rótulo para a UI ("Teses e dissertações · Admin")
```

`workspaceProjectIds(user)` continua existindo e devolve só `scope.projectIds`.

**Regra:** qualquer página, action, endpoint ou relatório que conte/agregue algo por projeto
filtra por esse conjunto. Antes isso valia só para as páginas de plugin; o dashboard, os
relatórios, o activity log e o e-mail semanal ignoravam o filtro, então desligar "acadêmicos"
mudava `/projects` e deixava o dashboard contando teses. Hoje todos passam por aqui.

Para deixar visível *por que* os números mudaram, use
[`<WorkspaceScopeBar>`](src/components/workspace-scope-bar.tsx) no topo da página — ela mostra
"8 de 21 projetos" e o rótulo do contexto. Sem esse aviso a página filtrada parece quebrada.

O agendador do relatório semanal **não** tem usuário logado e continua cobrindo o laboratório
inteiro; só a execução manual (`generateWeeklyReportNow`) aplica o escopo de quem clicou.

---

## 6. RBAC e permissões

[`src/lib/rbac.ts`](src/lib/rbac.ts):

```typescript
const user = await requireUser();                               // qualquer sessão válida
const user = await requirePermission("task:edit", projectId);   // lança se não tiver
const ok   = await hasPermission(user, "knowledge:edit", pid);  // check booleano
```

- `admin` sempre passa; `lead` do projeto herda as permissões de `project_manager` naquele projeto.
- Legado ainda em uso: `canWriteProject()`, `canViewProject()`, `isProjectLead()`, `canManageProject()`.
- Conhecimento tem camada própria: [`src/lib/knowledge-access.ts`](src/lib/knowledge-access.ts) (`canViewArticle`, `assertCanEditArticle`); artigos vindos do Nextcloud são **read-only** no LabFlow.

**Chaves** (formato `modulo:acao`) em [`src/lib/permissions-seed.ts`](src/lib/permissions-seed.ts), semeadas a cada boot. Módulos cobertos: `task`, `project`, `sprint`, `deliverable`, `requirement`, `roadmap`, `system_model`, `verification`, `knowledge`, `repository`, `forum`, `assistant`, `team`, `thesis`, `papers`, `publications`, `academic`, `report`, `feedback`, `activity_log`, `settings`.

`listPermissionKeysForUser()` devolve todas as chaves efetivas de um usuário — é o que `GET /api/v1/me` entrega para uma UI externa decidir o que renderizar sem descobrir por 403.

**Papéis globais:** `admin`, `researcher`, `project_manager`, `contributor`, `viewer`.
**Papéis por projeto** (`ProjectMembership.role`): `lead`, `contributor`, `viewer`, `advisor`, `coauthor`.
**Programa acadêmico** (`phd`, `msc`, …) vive em `AcademicProfile.program` — **não** é `User.role`.

---

## 7. Camada de IA

| Arquivo | Função |
|---------|--------|
| `src/lib/ai/config.ts` | Resolve config: `.env` + settings do plugin `assistant` (settings vencem) |
| `src/lib/ai/provider.ts` | `chatComplete()` (com ferramentas), `chat()`, `embed()`, `embedMany()` |
| `src/lib/ai/embeddings.ts` | Vetores locais hashed + `lexicalScore()` para a busca híbrida |
| `src/lib/ai/rag.ts` | `ingest()`, `search()`, `searchGroups()`, `purge()`, `embeddingIndexStats()` |
| `src/lib/ai/agent.ts` | Assistente RAG + loop de ferramentas (`runToolLoop`) |
| `src/lib/ai/knowledge-indexer.ts` | Indexa entidades; `reindexAll()` reconstrói o índice |
| `src/lib/ai/feedback-agent.ts` | Demanda → drafts de tarefa/requisito |
| `src/lib/artifacts/*` | Geração, import/export e aceite de artefatos de IA |

### Contratos que importam

**Falha nunca é silenciosa.** Com provedor configurado, `chat()` lança `AiProviderError`
(com status e mensagem do provedor) em vez de cair no modo offline fingindo ser uma resposta.
Há timeout (60s chat / 30s embed) e 3 tentativas com backoff. Quem quiser degradar de forma
elegante captura explicitamente — `askKnowledge` faz isso e devolve `degraded: true` + `error`.

**Vetores só são comparáveis dentro do mesmo modelo de embedding.** Cada linha de `Embedding`
guarda `modelName`, e `search()` filtra por ele. Trocar de provedor ou de modelo torna o índice
antigo invisível — por isso existe `reindexAll()` e o painel *Configurações → IA → Índice
semântico*, que mostra `total / pesquisáveis / obsoletos`. Linhas legadas com `modelName` nulo
são tratadas como `local`.

**Embedding indisponível degrada de forma visível.** Se o modelo configurado não existe no
provedor (típico: Ollama sem `ollama pull`), o sistema cai para vetores locais, registra o
motivo em `embeddingRuntimeStatus()` e o painel exibe o aviso. `currentEmbeddingModelName()`
passa a devolver `local` para que rótulo e conteúdo do vetor não divirjam.

**A busca é híbrida.** `score = 0.75 × cosseno + 0.25 × sobreposição léxica`, com corte
relativo ao melhor resultado (35%). O termo léxico existe para códigos (`REQ-014`), chaves de
projeto e nomes próprios, que embeddings hashados erram. `ragScanLimit` é um teto de segurança
(`0` = sem limite); acima dele os candidatos são escolhidos por correspondência de termos,
**nunca só pelos mais recentes** — a versão anterior tornava conteúdo antigo permanentemente
invisível.

**Permissão é aplicada antes do corte.** `askKnowledge` busca 4× o limite, filtra com
`filterRagHitsForUser` e só então trunca.

**Ferramentas executam de verdade — e propõem, não escrevem.** `chatComplete()` oferece as
`aiTools` ao modelo (function calling em OpenAI e Ollama) e `runToolLoop` em `agent.ts` executa
o que ele pedir, em até 4 passos. Cada tool declara `kind`:

| `kind` | Contrato |
|--------|----------|
| `read` | Responde uma pergunta; executa na hora |
| `propose` | **Nunca muta domínio.** Cria um `AiDraft` que uma pessoa revisa e aceita |

`run` é responsável pela própria autorização (recebe `ctx.user`), e nenhuma tool é oferecida ao
modelo quando não há usuário autenticado. Modelo local sem suporte a tools? O provider detecta,
avisa no log e responde só com o contexto. Referência: `src/plugins/example/index.ts`
(`list_projects` + `propose_task`).

**Toda execução do assistente é registrada.** `AgentRun` guarda latência, tokens, ferramentas
usadas e erro; visível em *Configurações → IA → Execuções do assistente*.

**Conteúdo inalterado não é reembedado.** `Embedding.contentHash` (sha256 dos chunks) faz
`ingest()` sair cedo quando nem o texto nem o modelo mudaram.

Embeddings são gravados em `Embedding.vector` como **JSON** (portável; troque por `pgvector` se
precisar escalar — ajuste `rag.ts`).

`AI_PROVIDER=none` continua funcional: busca híbrida local + respostas extrativas, sem LLM.

---

## 8. API REST de plugins

```
/api/v1/{pluginId}/{subPath}
```

- **Catch-all:** [`src/app/api/v1/[...path]/route.ts`](src/app/api/v1/[...path]/route.ts) — GET, POST, PATCH, PUT, DELETE.
- **Catálogo:** `GET /api/v1` lista todas as rotas via `listRegisteredApiRoutes()`, mais auth, envelope, paginação e CORS configurado.
- **Auth** ([`src/plugins/api-auth.ts`](src/plugins/api-auth.ts)), nesta ordem: Bearer `lf_...` (API key) → Bearer JWT → **cookie de sessão do browser** (para links do catálogo em Configurações e fetches same-origin).
- **Contexto:** `runWithApiUser` ([`src/lib/request-user.ts`](src/lib/request-user.ts)) usa `AsyncLocalStorage` para que server actions e `getSession()` enxerguem o usuário da chave.
- **Registro:** `registerApiHandlers(id, { "GET items": h, "PATCH items/:id": h })` — barra inicial opcional, `normalizeApiPath` cuida disso.
- **Respostas:** `jsonOk` / `jsonError` de [`src/plugins/api-utils.ts`](src/plugins/api-utils.ts) → `{ ok: true, data }` ou `{ ok: false, error }`. `runApiAction(fn)` embrulha uma action e mapeia erro → status (401/403/404/400) pela mensagem.
- Plugin desabilitado responde 404. As permissões são **as mesmas da UI**.

Referências boas: [`src/plugins/board/api.ts`](src/plugins/board/api.ts), [`src/plugins/knowledge/api.ts`](src/plugins/knowledge/api.ts), [`src/plugins/repository/api.ts`](src/plugins/repository/api.ts) (a mais completa: busca facetada, upload multipart, download de bytes, IA).

### Modo headless — para uma UI própria fora do Next

Rotas que vivem **fora** do catch-all porque não pertencem a um plugin:

| Rota | Papel |
|------|-------|
| `POST /api/v1/auth/token` | troca e-mail/senha por JWT (`ttlHours`, teto 720h). Senha errada e usuário inexistente devolvem a mesma mensagem, e ambos rodam bcrypt — não vaza quais contas existem |
| `GET /api/v1/me` | identidade, **permissões efetivas** (`listPermissionKeysForUser`), nav filtrado e escopo ativo |
| `GET /api/v1/openapi.json` | OpenAPI 3.1 gerado do registry em runtime |

**CORS** ([`src/plugins/api-cors.ts`](src/plugins/api-cors.ts)): nada é liberado por padrão.
`API_CORS_ORIGINS` é uma allowlist separada por vírgula; com `*` qualquer origem passa mas o
cookie de sessão deixa de ser aceito (regra do fetch — credenciais e `*` são incompatíveis).
Todas as rotas `/api/v1` respondem `OPTIONS`, e as respostas de erro **também** levam os
cabeçalhos CORS, senão o navegador esconde o motivo da falha.

**Upload multipart:** `readJsonBody` só tenta `request.json()` quando o `Content-Type` é JSON.
Sem essa checagem o stream era consumido e `request.formData()` chegava vazio ao handler — é o
que permite `POST .../records/:id/files` funcionar dentro do catch-all.

---

## 9. Convenções de código

1. **Server Actions** — `"use server"` no topo; autenticar antes de mutar; preferir retornar `{ error: string }` quando a action é chamada por client component (`throw` só em action interna ou com try/catch na UI).
2. **Mutações** — sempre `emit()` depois de create/update/delete; `revalidatePath()` se a UI precisa refletir.
3. **Componentes** — server component busca dados e passa props **serializáveis**; client component leva `"use client"` e **nunca** importa Prisma.
4. **Prisma** — enums são `String`; campos JSON são `String` com parse manual (helpers como `parseProjectFeatures`, `parsePreferences`).
5. **Imports** — alias `@/` → `src/`.
6. **UI** — Tailwind + `src/components/ui/`; ícones Lucide (registre em `nav-icons.tsx` se for de nav).
7. **`import "server-only"`** — em qualquer módulo que toque Prisma, registry ou eventos.
8. **Escopo** — mudanças mínimas; não refatore o que a tarefa não pediu; não commite/push sem pedido explícito.
9. **Idioma** — UI e mensagens em português; identificadores e comentários em código, em inglês ou português sem acento, seguindo o arquivo vizinho.

---

## 10. Comandos

```bash
npm install
npm run setup          # prisma db push + seed
npm run dev            # http://localhost:3000
npm run typecheck      # ← portão obrigatório
npm run lint
npm run build          # prisma generate + next build
npm run db:studio      # GUI do banco
```

Usuários de seed: `admin@lab.edu` / `admin123`; demais `@lab.edu` / `lab12345`.

**Antes de dar a tarefa por concluída:** `npm run typecheck` sem erros. `npm run lint` ainda não
está configurado neste repositório — não conte com ele.

---

## 11. Receitas — onde mexer por tarefa

| Tarefa | Arquivos |
|--------|----------|
| Novo módulo/plugin | `src/plugins/<id>/{manifest,actions,page,api}` + `index.ts` + `nav-icons.tsx` + `app/(app)/<rota>/page.tsx` + `permissions-seed.ts` |
| Campo novo numa entidade | `prisma/schema.prisma` → `npm run db:push` → action → componente |
| Nova permissão | `permissions-seed.ts` + `hasPermission`/`requirePermission` na action + gate na UI |
| Novo evento de domínio | `DomainEventType` em `events.ts` + `emit()` na action + subscriber em `bootstrap.ts` |
| Indexar conteúdo no RAG | subscriber em `bootstrap.ts` → `ingest()` ou indexer em `knowledge-indexer.ts` |
| Ferramenta de IA | `manifest.aiTools` com `kind` + `required`; RBAC dentro do `run`; mutação só via `AiDraft` |
| Setting de plugin | `manifest.settingsSchema` + ler com `getPluginSettings(id)` |
| Endpoint REST | `src/plugins/<id>/api.ts` + `API_REGISTRATIONS` |
| Link wiki ↔ entidade | `src/plugins/knowledge/link-actions.ts`, model `KnowledgeLink` |
| Item some do menu | os três filtros em `src/lib/nav-visibility.ts` (§4) |
| Número novo num painel/KPI | `resolveWorkspaceScope()` + filtrar por `scope.projectIds` (§5b) + `<WorkspaceScopeBar>` |
| Saúde/risco de projeto | `src/lib/portfolio.ts` (`getPortfolioOverview`) — reutilizado por dashboard, `/reports` e API |
| Linha nova no Gantt | `src/lib/gantt.ts` (`getGanttData`) + `GanttRow` em `src/lib/gantt-types.ts` |
| Campo novo no repositório | `prisma/schema.prisma` (`RepositoryRecord`) → `db:push` → `src/lib/repository/{vocab,search}.ts` → form em `src/components/repository/record-form.tsx` |
| Endpoint para UI externa | §8 "Modo headless" — e libere a origem em `API_CORS_ORIGINS` |
| Sync Nextcloud | `src/plugins/knowledge/{sync,auto-sync,nextcloud-client}.ts` |

---

## 12. Armadilhas conhecidas

- **Não há middleware de auth.** A proteção é `requireUser()` em `src/app/(app)/layout.tsx` e em cada action. Rota nova fora de `(app)` nasce **pública** — autentique explicitamente.
- **Bootstrap é global e idempotente** (`globalThis.__labflowBootstrapped`). `bootstrapAsync()` roda a cada request do layout e da API; mantenha barato o que adicionar lá.
- **`emit()` grava no `ActivityLog`.** Eventos em loop poluem a timeline e o BI de relatórios.
- **Trocar o modelo de embedding invalida o índice.** Reindexe em Configurações → IA, senão a
  busca deixa de encontrar o conteúdo já indexado.
- **JSON em `String`.** Nunca confie no shape sem parse defensivo.
- **`src/plugins/academic/` está órfão** (não registrado) — ver §4.
- **Plugin novo exige reiniciar o processo em dev.** `registerPlugin()` agora invalida o cache
  quando vê um manifest inédito, mas o registry é global (`globalThis`): se o processo já tinha
  o manifest carregado, o HMR não refaz a lista. Sintoma: rotas do plugin devolvem
  `Plugin nao encontrado ou desativado` mesmo com a linha em `Plugin` habilitada.
- **Repositório ≠ Biblioteca.** `KnowledgeArticle` é wiki espelhado do vault Nextcloud;
  `RepositoryRecord` é depósito citável com handle, metadados e bytes em **disco local**
  (`REPOSITORY_STORAGE_DIR`). Não misture os dois: o vault sobrescreve o que você editar,
  o repositório não depende do Nextcloud.
- **Arquivo sem texto extraído não é pesquisável nem responde à IA.** PDF digitalizado ou
  imagem entram como depósito válido, mas `fullText` fica vazio. A UI avisa; não finja que o
  acervo está coberto.
- **O Gantt nunca inventa datas.** Pacote e projeto agregam dos filhos; tarefa só com prazo
  ganha início inferido e barra hachurada; o que não tem data alguma vai para o aviso
  "itens sem data". Se mudar isso, mude o aviso também.
- **Artigos Nextcloud são read-only**: editar no vault e re-sincronizar; escrever direto no LabFlow será sobrescrito.
- **Documentação também vive no produto:** [`src/lib/docs-seed.ts`](src/lib/docs-seed.ts) semeia 7 artigos (Arquitetura, Plugins, Módulos Recentes, Padrões de Código, Guia Rápido, Guia do Admin, API REST) na base de conhecimento. Ao mudar arquitetura de forma relevante, atualize também esse arquivo — senão o assistente in-app passa a mentir.

---

## 13. Contexto para outros agentes

- **Cursor** — regras em `.cursor/rules/labflow-*.mdc` (core sempre ativa; plugins e server-actions por glob) e skills em `.cursor/skills/`.
- **Claude Code** — `CLAUDE.md` na raiz aponta para este arquivo.
- **Qualquer agente** — este arquivo (`AGENTS.md`) é o contrato. Mantenha-o verdadeiro: ao mudar arquitetura, atualize aqui, em `docs/ARCHITECTURE.md` e em `src/lib/docs-seed.ts`.
