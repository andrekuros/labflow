# LabFlow — Guia para Agentes de IA

Plataforma **self-hosted** de gestão de laboratório de pesquisa (Next.js 15, Prisma, SQLite/PostgreSQL). Este arquivo orienta agentes de IA (Cursor, Copilot, etc.) sobre arquitetura, convenções e onde modificar código.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15 App Router, React 19, Tailwind |
| Backend | Server Actions, Route Handlers, Prisma ORM |
| Auth | JWT em cookie httpOnly (`jose` + `bcryptjs`) |
| IA | OpenAI / Ollama / offline + RAG com embeddings |
| Extensibilidade | Sistema de plugins + event bus in-process |

## Estrutura de pastas

```
labflow/
├── AGENTS.md                 ← este arquivo
├── docs/CURSOR.md            ← guia para humanos usando Cursor
├── .cursor/rules/            ← regras persistentes do Cursor
├── .cursor/skills/           ← skills do projeto
├── prisma/schema.prisma      ← modelo de dados
├── prisma/seed.ts            ← dados de demonstração
└── src/
    ├── app/                  ← rotas App Router
    │   ├── (app)/            ← páginas autenticadas (thin wrappers)
    │   ├── actions/          ← server actions globais (auth, settings)
    │   └── api/              ← route handlers (backup, /api/v1/*)
    ├── components/           ← UI React (client + shared)
    ├── lib/                  ← auth, RBAC, eventos, IA, utilitários
    ├── plugins/              ← módulos (manifest + actions + page + api)
    └── server/bootstrap.ts   ← ingestão RAG, plugins, schedulers
```

## Arquitetura central

### Sistema de plugins

Cada módulo é um plugin registrado em `src/plugins/index.ts`:

| Plugin ID | Rota | Grupo nav | Descrição |
|-----------|------|-----------|-----------|
| `projects` | `/projects` | Trabalho | Projetos, WBS, ConOps, artefatos IA |
| `board` | `/board` | Trabalho | Kanban drag-and-drop |
| `planning` | `/planning` | Trabalho | Visão unificada (req, entregáveis, roadmap, sprints) |
| `sprints` | `/sprints` | Trabalho | Ciclos de sprint |
| `roadmap` | `/roadmap` | Trabalho | Marcos e timeline |
| `deliverables` | `/deliverables` | Trabalho | Entregáveis e critérios |
| `requirements` | `/requirements` | Trabalho | Requisitos e rastreabilidade |
| `system-model` | `/system-model` | Eng. Sistemas | Modelo do sistema |
| `verification` | `/verification` | Eng. Sistemas | Casos de verificação |
| `knowledge` | `/knowledge` | Conhecimento | Wiki, Nextcloud, links, RAG |
| `forum` | `/forum` | Conhecimento | Canais e tópicos |
| `assistant` | `/assistant` | Conhecimento | Assistente RAG |
| `team` | `/team` | Equipe | Perfis e gestão |
| `thesis` | `/thesis` | Pesquisa | Teses e dissertações (projetos) |
| `papers` | `/papers` | Pesquisa | Artigos científicos (projetos) |
| `reports` | `/reports` | Gestão | Relatórios de atividade / BI |
| `feedback` | `/feedback` | Administração | Bugs e sugestões + agente IA |
| `labflow.example-task-assistant` | — | — | Plugin de exemplo |

Contrato: `src/plugins/types.ts` (`PluginManifest`).

Arquivos típicos por plugin:
- `manifest.ts` — metadata, nav, settings, dependências
- `actions.ts` — server actions (`"use server"`)
- `page.tsx` — server component (busca dados)
- `api.ts` — handlers REST (`GET /path`, `POST /path/:id`)
- `src/components/<modulo>/` — client components interativos
- `src/app/(app)/<rota>/page.tsx` — reexporta o plugin page

Registro obrigatório em `src/plugins/index.ts` (manifest + API handlers) e ícone em `src/plugins/nav-icons.tsx`.

### Event bus

`src/lib/events.ts` — pub/sub in-process. Tipos: `task.created`, `article.updated`, `feedback.submitted`, etc.

Após mutações significativas, chame `emit({ type, actorId, projectId, payload })`. Subscribers: RAG, activity log, plugins, feedback agent.

### RBAC e permissões

`src/lib/rbac.ts`:
- `requireUser()` / `requirePermission("modulo:acao", projectId?)`
- `hasPermission(user, key, projectId?)` — admin sempre passa; lead herda `project_manager` no projeto
- Legacy: `canWriteProject()` / `canViewProject()`

Chaves em `src/lib/permissions-seed.ts` (formato `modulo:acao`). Papéis globais: `admin`, `researcher`, `project_manager`, `contributor`, `viewer`. Papéis acadêmicos (`phd`, `msc`) ficam em `AcademicProfile.program`.

Conhecimento: `src/lib/knowledge-access.ts` — visibilidade por projeto, artigos Nextcloud são read-only.

### Camada de IA

| Arquivo | Função |
|---------|--------|
| `src/lib/ai/provider.ts` | Chat e embeddings (OpenAI/Ollama/offline) |
| `src/lib/ai/config.ts` | Config (.env + settings do plugin assistant) |
| `src/lib/ai/rag.ts` | Ingestão e busca semântica |
| `src/lib/ai/agent.ts` | Assistente RAG + ferramentas de plugins |
| `src/lib/ai/knowledge-indexer.ts` | Indexação de tasks, projetos, usuários |
| `src/lib/ai/feedback-agent.ts` | Processa feedback → drafts |
| `src/lib/artifacts/*` | Geração/import/export de artefatos IA |

Bootstrap RAG: `src/server/bootstrap.ts` (eventos → ingest/index).

### API REST de plugins

- Catch-all: `src/app/api/v1/[...path]/route.ts` → `/api/v1/{pluginId}/{subPath}`
- Catalogo: `GET /api/v1` (`src/app/api/v1/route.ts`) lista rotas via `listRegisteredApiRoutes()`
- Auth: Bearer `lf_...` (API key) ou JWT em `src/plugins/api-auth.ts` — **sem** cookie de sessao
- Contexto: `runWithApiUser` (`src/lib/request-user.ts`) faz actions/`getSession` enxergarem o usuario da chave
- Handlers: `registerApiHandlers(id, { "GET items": handler, "POST items": handler })` em `src/plugins/<id>/api.ts`
- Paths normalizados (barra inicial opcional). Preferir CRUD do recurso primario + `hasPermission` / `runApiAction`

## Convenções de código

1. **Server Actions**: topo `"use server"`; autenticar com `requireUser()` ou `requirePermission()`; preferir retornar `{ error: string }` a lançar exceções em actions expostas à UI
2. **Mutations**: emitir evento de domínio após create/update/delete
3. **Componentes**: server components buscam dados; client components (`"use client"`) recebem props serializáveis
4. **Prisma**: enums como `String`; JSON como `String` com parse manual
5. **Imports**: alias `@/` → `src/`
6. **UI**: Tailwind + componentes em `src/components/ui/`; ícones Lucide
7. **Escopo**: mudanças mínimas; não refatorar código não relacionado à tarefa

## Comandos

```bash
npm install
npm run setup          # db push + seed
npm run dev            # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

Usuários seed: `admin@lab.edu` / `admin123`, demais `@lab.edu` / `lab12345`.

## Onde começar por tarefa

| Tarefa | Arquivos principais |
|--------|---------------------|
| Novo módulo | `src/plugins/<id>/`, `index.ts`, `nav-icons.tsx`, `app/(app)/<rota>/` |
| Permissão nova | `permissions-seed.ts` + action com `hasPermission` |
| Indexar no RAG | `bootstrap.ts` (evento) ou `knowledge-indexer.ts` |
| Ferramenta IA | `manifest.aiTools` no plugin + `listAiTools()` |
| Settings de plugin | `manifest.settingsSchema` + UI em settings |
| Link wiki ↔ entidade | `knowledge/link-actions.ts`, model `KnowledgeLink` |

## Skills e regras do Cursor

- Skills: `.cursor/skills/labflow-dev/`, `labflow-plugin/`, `labflow-ai/`
- Regras: `.cursor/rules/labflow-*.mdc`
- Guia humano: `docs/CURSOR.md`

Documentação interna também é seedada na base de conhecimento via `src/lib/docs-seed.ts` (artigos visíveis no assistente LabFlow).
