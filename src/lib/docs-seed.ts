import "server-only";
import { prisma } from "@/lib/db";
import { ingest } from "@/lib/ai/rag";

type DocArticle = { title: string; tags: string; content: string };

const DEV_SKILLS: DocArticle[] = [
  {
    title: "LabFlow — Visao Geral da Arquitetura",
    tags: "dev,arquitetura,skill,cursor",
    content: `# Visao Geral da Arquitetura do LabFlow

## Stack Tecnologica
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **ORM:** Prisma (SQLite em dev, PostgreSQL em producao)
- **Autenticacao:** JWT via cookies httpOnly (jose + bcryptjs)
- **UI:** Tailwind CSS + componentes customizados
- **IA:** OpenAI / Ollama / offline + RAG com embeddings

## Documentacao para IA (Cursor)
- \`AGENTS.md\` — guia principal para agentes
- \`docs/CURSOR.md\` — como usar Cursor neste repo
- \`.cursor/rules/\` — regras automaticas
- \`.cursor/skills/\` — skills labflow-dev, labflow-plugin, labflow-ai

## Modulos (plugins)
projects, board, planning, sprints, roadmap, deliverables, requirements, system-model, verification, knowledge, forum, assistant, team, academic, reports, feedback.

## Estrutura de Pastas
\`\`\`
src/
  app/           → App Router (paginas, layouts, rotas API)
  components/    → Componentes React reutilizaveis
  lib/           → Auth, RBAC, eventos, IA, utilitarios
  plugins/       → Modulos (manifest + actions + page + api)
  server/        → Bootstrap (RAG, plugins, schedulers)
prisma/schema.prisma
\`\`\`

## Event Bus
\`src/lib/events.ts\` — pub/sub in-process. Mutacoes emitem \`task.created\`, \`article.updated\`, etc. Subscribers: RAG, activity log, plugins, feedback agent.

## RBAC
\`hasPermission(user, "modulo:acao", projectId?)\` em \`src/lib/rbac.ts\`.
Papeis globais: admin, researcher, project_manager, contributor, viewer.
Papeis de projeto: lead, contributor, viewer (membership).
Conhecimento: \`src/lib/knowledge-access.ts\` (visibilidade por projeto; Nextcloud read-only).

## RAG
Artigos, tarefas, projetos, perfis indexados em embeddings. Assistente em \`/assistant\`. Config: .env AI_* ou Configuracoes > IA.
`,
  },
  {
    title: "LabFlow — Guia de Desenvolvimento de Plugins",
    tags: "dev,plugin,skill",
    content: `# Guia de Desenvolvimento de Plugins

## Criando um Novo Plugin

### 1. Manifest (\`src/plugins/meu-plugin/manifest.ts\`)
\`\`\`typescript
import type { PluginManifest } from "@/plugins/types";

export const meuPluginManifest: PluginManifest = {
  id: "meu-plugin",
  name: "Meu Plugin",
  version: "1.0.0",
  description: "Descricao do plugin.",
  icon: "Puzzle", // nome do icone Lucide
  nav: { label: "Meu Plugin", href: "/meu-plugin", icon: "Puzzle", order: 50 },
  apiPrefix: "/api/v1/meu-plugin",
};
\`\`\`

### 2. Server Actions (\`src/plugins/meu-plugin/actions.ts\`)
\`\`\`typescript
"use server";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/rbac";
import { emit } from "@/lib/events";

export async function minhaAction(data: MeuTipo) {
  const user = await requireUser();
  // verificar permissao
  // executar logica
  // emitir evento
}
\`\`\`

### 3. Server Page (\`src/plugins/meu-plugin/page.tsx\`)
Componente servidor que busca dados e renderiza o client component.

### 4. Client Component (\`src/components/meu-plugin/client.tsx\`)
Componente \`"use client"\` com interatividade.

### 5. Rota (\`src/app/(app)/meu-plugin/page.tsx\`)
\`\`\`typescript
import MeuPluginPage from "@/plugins/meu-plugin/page";
export default function Page() { return <MeuPluginPage />; }
\`\`\`

### 6. Registro (\`src/plugins/index.ts\`)
Importar manifest e api handlers, adicionar aos arrays.

### 7. Icone (\`src/plugins/nav-icons.tsx\`)
Importar e registrar o icone Lucide correspondente.

### 8. Permissoes (\`src/lib/permissions-seed.ts\`)
Adicionar chaves \`modulo:acao\` e defaults por papel.

Veja skill Cursor \`labflow-plugin\` e plugin de referencia \`src/plugins/reports/\`.
`,
  },
  {
    title: "LabFlow — Modulos Recentes",
    tags: "dev,modulos,skill",
    content: `# Modulos Recentes do LabFlow

## Planejamento (\`/planning\`)
Visao unificada por projeto: requisitos, entregaveis, roadmap e sprints.
Plugin: \`src/plugins/planning/\`. Depende de \`projects\`.

## Relatorios (\`/reports\`)
Relatorios de atividade por usuario/periodo e painel BI para admins.
Permissoes: \`report:view\`, \`report:view_all\`, \`report:export\`.
Plugin: \`src/plugins/reports/\`.

## Conhecimento — Links e Nextcloud
- \`KnowledgeLink\`: vincula artigos a tasks, deliverables, requirements
- Actions: \`src/plugins/knowledge/link-actions.ts\`
- Nextcloud: sync .md read-only; editar no vault externo
- Setting \`ragScanLimit\`: limite de chunks na busca semantica

## Feedback + Agente IA
Feedback em \`/feedback\` dispara \`feedback.submitted\` → \`feedback-agent.ts\` gera drafts.
Configure projeto destino em Configuracoes > Plugins > Feedback.
`,
  },
  {
    title: "LabFlow — Padroes de Codigo",
    tags: "dev,padroes,skill",
    content: `# Padroes de Codigo do LabFlow

## Server Actions
- Sempre usar \`"use server"\` no topo do arquivo
- Iniciar com \`requireUser()\` ou \`requirePermission()\`
- Usar \`emit()\` para eventos apos mutacoes

## Componentes React
- **Server Components**: buscam dados via Prisma, sem estado
- **Client Components**: \`"use client"\`, recebem dados serializados via props
- Props devem ser tipos simples (strings, arrays de objetos serializaveis)

## Banco de Dados
- Usar Prisma para todas as queries
- Enums sao modelados como String (SQLite nao suporta enums nativos)
- Campos JSON sao armazenados como String com parse/serialize manual

## RBAC
- Usar \`hasPermission(user, "modulo:acao", projectId?)\` para verificacoes
- \`requirePermission("modulo:acao", projectId?)\` redireciona automaticamente
- Admin sempre tem acesso total
- Lead de projeto herda permissoes de project_manager no projeto
- Legacy: \`canWriteProject\` / \`canViewProject\` ainda usados em alguns modulos
- Conhecimento: \`canViewArticle\`, \`canEditArticle\` em knowledge-access.ts

## Eventos
- Emitir eventos para toda mutacao significativa
- Formato: \`{ type: "entidade.acao", actorId, projectId, payload }\`

## Tratamento de Erros
- Server actions retornam \`{ error: string }\` em caso de falha
- Nunca lancar excecoes em server actions (retornar objeto de erro)
`,
  },
];

const USER_DOCS: DocArticle[] = [
  {
    title: "LabFlow — Guia Rapido",
    tags: "docs,usuario,guia",
    content: `# Guia Rapido do LabFlow

## O que e o LabFlow?
LabFlow e uma plataforma de gestao de laboratorios de pesquisa. Permite gerenciar projetos, tarefas, requisitos, entregaveis, base de conhecimento e muito mais.

## Primeiros Passos
1. **Login**: Acesse com email e senha. Se o admin habilitou, voce pode se cadastrar pela tela de login.
2. **Dashboard**: A pagina inicial mostra um resumo dos seus projetos e tarefas.
3. **Projetos**: Crie ou acesse projetos existentes. Cada projeto tem Kanban, Sprints, Requisitos, Entregaveis.
4. **Kanban**: Arraste tarefas entre colunas (Backlog, To Do, Em Progresso, Revisao, Feito).
5. **Conhecimento**: Consulte artigos da base de conhecimento ou crie novos.
6. **Assistente IA**: Faca perguntas ao assistente sobre seus projetos e dados.

## Feedback
Use o menu **Feedback** para reportar bugs ou sugerir melhorias. A IA pode gerar tarefas automaticamente a partir do seu feedback.

## Acompanhamento Academico
Alunos de mestrado/doutorado podem preencher seu perfil academico com metodologia, disciplinas e pendencias.
`,
  },
  {
    title: "LabFlow — Guia do Administrador",
    tags: "docs,admin,guia",
    content: `# Guia do Administrador

## Gerenciamento de Usuarios
- Acesse **Equipe** para ver e gerenciar usuarios
- Aprove ou rejeite cadastros pendentes
- Importe usuarios via CSV (nome, email, senha)
- Altere papeis: Administrador, Pesquisador, Gerente de Projetos, Colaborador, Visualizador

## Permissoes
- Acesse **Configuracoes > Permissoes** para ajustar permissoes por papel
- Cada papel tem permissoes por modulo (ver, criar, editar, excluir)
- Admin sempre tem acesso total

## Configuracao de IA
- Em **Configuracoes > IA**, configure o provedor (OpenAI, Ollama ou offline)
- A IA e usada pelo assistente, geracao de artefatos e processamento de feedback

## Nextcloud
- Em **Configuracoes > Conhecimento**, configure a integracao com Nextcloud
- Arquivos .md sao sincronizados e indexados no RAG automaticamente

## Backup
- Em **Configuracoes > Integracoes**, baixe um backup completo do banco de dados

## API REST
- Gere chaves em **Configuracoes > Integracoes**
- Consulte o catalogo em \`GET /api/v1\` e o artigo **LabFlow — API REST**

## Feedback
- Configure o projeto que recebera sugestoes da IA em **Configuracoes > Plugins > Feedback**
`,
  },
  {
    title: "LabFlow — API REST",
    tags: "docs,api,integracao,rest",
    content: `# API REST do LabFlow

Base URL: \`/api/v1\`

## Autenticacao

Todas as rotas exigem o header:

\`\`\`
Authorization: Bearer lf_...
\`\`\`

Gere a chave em **Configuracoes > Integracoes** (apenas admin). JWT Bearer tambem e aceito.
Se voce estiver logado no LabFlow, abrir \`/api/v1\` no navegador tambem funciona (cookie de sessao).
Integracoes externas devem usar a chave \`lf_...\`.

## Catalogo automatico

\`\`\`bash
curl -H "Authorization: Bearer lf_SUA_CHAVE" http://localhost:3000/api/v1
\`\`\`

Resposta: lista de plugins habilitados e rotas \`method\` + \`url\` registradas em runtime.

## Formato de resposta

- Sucesso: \`{ "ok": true, "data": ... }\`
- Erro: \`{ "ok": false, "error": "mensagem" }\` (401/403/404/400)

Permissoes RBAC sao as mesmas da UI (\`modulo:acao\`).

## Exemplos

### Listar tarefas
\`\`\`bash
curl -H "Authorization: Bearer lf_SUA_CHAVE" \\
  "http://localhost:3000/api/v1/board/tasks?projectId=PROJECT_ID"
\`\`\`

### Criar tarefa
\`\`\`bash
curl -X POST -H "Authorization: Bearer lf_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"PROJECT_ID","title":"Nova tarefa"}' \\
  http://localhost:3000/api/v1/board/tasks
\`\`\`

### Assistente
\`\`\`bash
curl -X POST -H "Authorization: Bearer lf_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"question":"Quais projetos estao ativos?"}' \\
  http://localhost:3000/api/v1/assistant/ask
\`\`\`

## Recursos principais

| Plugin | Prefixo | Recursos |
|--------|---------|----------|
| projects | /api/v1/projects | projects (CRUD) |
| board | /api/v1/board | tasks (CRUD) |
| knowledge | /api/v1/knowledge | articles (CRUD), search, sync-nextcloud, health |
| team | /api/v1/team | users (CRUD) |
| sprints | /api/v1/sprints | sprints |
| requirements | /api/v1/requirements | requirements |
| deliverables | /api/v1/deliverables | deliverables |
| roadmap | /api/v1/roadmap | milestones |
| forum | /api/v1/forum | channels, threads, posts |
| system-model | /api/v1/system-model | elements, interfaces, diagrams |
| verification | /api/v1/verification | cases |
| assistant | /api/v1/assistant | ask |
| feedback | /api/v1/feedback | feedbacks |
| activity-log | /api/v1/activity-log | log + filters |
| reports | /api/v1/reports | activity, team-overview |
| planning | /api/v1/planning | agregacao ?projectId= |
| thesis / papers | /api/v1/thesis, /papers | list/create/get |

Para a lista completa e sempre atualizada, use \`GET /api/v1\`.
`,
  },
];

const ALL_DOCS = [...DEV_SKILLS, ...USER_DOCS];

/** Creates documentation articles if they don't already exist. Idempotent. */
export async function ensureDocArticles() {
  for (const doc of ALL_DOCS) {
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { title: doc.title },
    });
    if (existing) continue;

    const article = await prisma.knowledgeArticle.create({
      data: {
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
      },
    });

    await ingest({
      sourceType: "article",
      sourceId: article.id,
      text: `${article.title}\n${article.content}`,
    });
  }
}
