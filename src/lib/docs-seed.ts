import "server-only";
import { prisma } from "@/lib/db";
import { ingest } from "@/lib/ai/rag";

type DocArticle = { title: string; tags: string; content: string };

const DEV_SKILLS: DocArticle[] = [
  {
    title: "LabFlow — Visao Geral da Arquitetura",
    tags: "dev,arquitetura,skill",
    content: `# Visao Geral da Arquitetura do LabFlow

## Stack Tecnologica
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **ORM:** Prisma (SQLite em dev, PostgreSQL em producao)
- **Autenticacao:** JWT via cookies httpOnly (jose + bcryptjs)
- **UI:** Tailwind CSS + componentes customizados (sem biblioteca de componentes externa)
- **IA:** OpenAI API / Ollama local + RAG com embeddings locais

## Estrutura de Pastas
\`\`\`
src/
  app/           → App Router (paginas, layouts, rotas API)
  components/    → Componentes React reutilizaveis
  lib/           → Logica de negocio, utilitarios, auth, RBAC, eventos
  plugins/       → Modulos do sistema (cada plugin = manifest + actions + page)
  server/        → Bootstrap do servidor
prisma/
  schema.prisma  → Schema do banco de dados
\`\`\`

## Conceitos Principais

### Sistema de Plugins
Cada modulo do LabFlow e um plugin com:
- **Manifest** (\`manifest.ts\`): metadata, icone, navegacao, settings schema
- **Actions** (\`actions.ts\`): server actions ("use server") para logica de negocio
- **Page** (\`page.tsx\`): server component para renderizacao SSR
- **API** (\`api.ts\`): handlers REST para integracao externa
- **Client Components** (\`src/components/\`): componentes React client-side

### Event Bus
O \`src/lib/events.ts\` e um pub/sub in-process. Eventos como \`task.created\`, \`project.updated\` sao emitidos e consumidos por subscribers (RAG, logs, notificacoes).

### RBAC
O controle de acesso usa \`hasPermission(user, permKey, projectId?)\` em \`src/lib/rbac.ts\`. Permissoes sao por modulo+acao e configuraveis pelo admin.

### RAG (Retrieval-Augmented Generation)
Artigos, tarefas, projetos e perfis sao indexados como embeddings. O assistente de IA busca contexto relevante antes de responder.
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
- \`requirePermission("modulo:acao")\` redireciona automaticamente
- Admin sempre tem acesso total (hardcoded)
- Leads de projeto herdam permissoes de project_manager dentro do projeto

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

## Feedback
- Configure o projeto que recebera sugestoes da IA em **Configuracoes > Plugins > Feedback**
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
