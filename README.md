# LabFlow

Plataforma self-hosted para gestao de laboratorio de pesquisa: Kanban filtravel, projetos/atividades (WBS), sprints, roadmap, entregaveis, requisitos com rastreabilidade, base de conhecimento com busca semantica, foruns, sistema de plugins e agentes de IA (RAG).

## Stack

- **Next.js 15** (App Router, React 19, Server Actions) + **TypeScript** + **Tailwind**
- **Prisma** + **SQLite** (dev, zero-infra) — portavel para PostgreSQL + pgvector
- Auth propria (JWT em cookie httpOnly) com RBAC global e por projeto
- Camada de IA abstrata (OpenAI/Ollama) com **fallback offline** (embeddings locais + RAG por similaridade de cosseno)
- Event bus de dominio que alimenta ingestao de conhecimento e plugins

## Como rodar

```bash
npm install
cp .env.example .env        # ajuste AUTH_SECRET (e a IA, se quiser)
npm run setup               # cria o banco SQLite e popula dados de exemplo
npm run dev                 # http://localhost:3000
```

Login de demonstracao: **admin@lab.edu** / **admin123** (demais usuarios usam senha `lab12345`).

### Scripts uteis

- `npm run dev` / `npm run build` / `npm start`
- `npm run db:push` — sincroniza o schema com o banco
- `npm run db:seed` — repopula dados de exemplo
- `npm run db:studio` — abre o Prisma Studio
- `npm run typecheck`

## Estrutura

```
prisma/schema.prisma        modelo de dados (todas as entidades)
src/lib/                    db, auth, rbac, eventos, IA (provider, embeddings, rag, agent)
src/app/actions/            camada de servico (server actions) por dominio
src/app/(app)/              paginas autenticadas (board, projects, sprints, roadmap, ...)
src/components/             UI e componentes por dominio
src/plugins/                SDK de plugins, registry e plugin de exemplo
src/server/bootstrap.ts     wiring de ingestao de conhecimento + carga de plugins
```

## IA (opcional)

Sem chave configurada, o assistente usa embeddings locais e respostas extrativas (modo offline). Para usar um LLM, ajuste no `.env`:

```
AI_PROVIDER="openai"        # ou "ollama"
AI_API_KEY="sk-..."
```

## Plugins

Um plugin e um `PluginManifest` (`src/plugins/types.ts`) que declara assinaturas de eventos, ferramentas de IA e contribuicoes de UI (slots). Registre em `src/plugins/index.ts`. Veja o exemplo em `src/plugins/example/`. O nucleo nao precisa ser alterado.

## Migrar para PostgreSQL + pgvector (producao)

1. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `"postgresql"` e ajuste `DATABASE_URL`.
2. Rode `npm run db:push`.
3. Os embeddings sao armazenados como JSON (portavel). Para escala maior, troque a coluna `Embedding.vector` por uma coluna `vector` do pgvector e ajuste `src/lib/ai/rag.ts` para usar o operador `<=>`.
