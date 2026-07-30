---
name: labflow-ai
description: Camada de IA do LabFlow — RAG, embeddings, assistente, feedback agent, artefatos e config OpenAI/Ollama. Use quando trabalhar com src/lib/ai/*, assistente, busca semantica, indexacao, AiDraft ou AI_PROVIDER.
---

# LabFlow — Camada de IA

## Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/ai/config.ts` | Lê `.env` + settings do plugin assistant |
| `lib/ai/provider.ts` | `chat()`, `embed()`, `aiEnabled()` |
| `lib/ai/embeddings.ts` | Fallback local (sem API) |
| `lib/ai/rag.ts` | `ingest()`, `search()` — chunks + cosine similarity |
| `lib/ai/agent.ts` | Assistente: RAG + LLM + aiTools de plugins |
| `lib/ai/knowledge-indexer.ts` | Indexa task/project/user/academic |
| `lib/ai/feedback-agent.ts` | Feedback → drafts de tarefa/requisito |
| `lib/artifacts/*` | ConOps, import/export, accept-draft |
| `server/bootstrap.ts` | Wiring eventos → ingest/index |

## Configuração

`.env`:
```env
AI_PROVIDER=none|openai|ollama
AI_API_KEY=...
AI_BASE_URL=...
AI_CHAT_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
```

UI admin: Configurações → IA (sobrescreve .env em runtime).

## Pipeline RAG

1. Conteúdo criado/atualizado → `emit(event)`
2. `bootstrap.ts` subscriber → `ingest()` ou `indexTask()` etc.
3. Embedding salvo em `Embedding` (JSON vector)
4. Pergunta no assistente → `search()` → top chunks → `chat()` com contexto

## Indexar novo tipo de conteúdo

1. Adicionar handler em `bootstrap.ts`:
   ```typescript
   on("myentity.updated", (e) => void indexMyEntity(e.payload?.id));
   ```
2. Implementar indexer em `knowledge-indexer.ts` ou chamar `ingest()` direto
3. Emitir evento na server action correspondente

## Plugin knowledge — settings relevantes

- `autoIngest` — indexação automática
- `enableSemanticSearch` — busca semântica na wiki
- `ragScanLimit` — limite de chunks na busca (default 2000)
- Nextcloud: sync .md → artigos → RAG

## Ferramentas IA (aiTools)

Declarar no `PluginManifest.aiTools`. O agente em `lib/ai/agent.ts` expõe via `listAiTools()`.

Exemplo: `src/plugins/example/index.ts` (`create_task`).

## Modo offline

`AI_PROVIDER=none`: busca semântica local + respostas extrativas dos chunks (sem LLM).

## Debug

- Assistente não encontra conteúdo → verificar `emit` na action + subscriber bootstrap
- Embeddings falham → provider cai para `localEmbed()` (log `[ai] embedding failed`)
- Artigos Nextcloud → read-only; editar no vault, re-sync
