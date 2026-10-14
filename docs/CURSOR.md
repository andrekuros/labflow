# LabFlow — Workflow com agentes de IA

Como usar Cursor, Claude Code e outros agentes de forma eficiente neste repositório.
Para a arquitetura em si, leia [AGENTS.md](../AGENTS.md) e [ARCHITECTURE.md](ARCHITECTURE.md).

## Arquivos de contexto

| Arquivo | Para quem | Conteúdo |
|---------|-----------|----------|
| `AGENTS.md` | Todos os agentes | **Entrada canônica**: arquitetura, plugins, convenções, receitas, armadilhas |
| `docs/ARCHITECTURE.md` | Todos | Visão geral com diagramas: camadas, request, event bus, dados |
| `CLAUDE.md` | Claude Code | Ponteiro para `AGENTS.md` + o essencial |
| `.cursor/rules/*.mdc` | Cursor (automático) | Regras por escopo de arquivo |
| `.cursor/skills/*/SKILL.md` | Cursor (sob demanda) | Workflows específicos |
| `README.md` | Humanos | Instalação e uso da plataforma |

## Skills do projeto

| Skill | Quando usar |
|-------|-------------|
| `labflow-dev` | Desenvolvimento geral, bugfix, refatoração |
| `labflow-plugin` | Criar ou alterar módulos/plugins |
| `labflow-ai` | RAG, assistente, embeddings, artefatos IA |

Exemplo de prompt:

> Use a skill labflow-plugin para adicionar um campo "prioridade" no módulo de entregáveis.

## Regras automáticas (Cursor)

- **labflow-core** — sempre ativa (stack, RBAC, eventos, escopo)
- **labflow-plugins** — ao editar `src/plugins/**`
- **labflow-server-actions** — ao editar `**/actions.ts`

## Orientando o agente

Um bom prompt neste repositório contém três coisas: **o arquivo de contexto a ler**, **o
módulo alvo** e **o limite de escopo**.

### Bugfix

```
Corrija [descrição]. Leia AGENTS.md e o plugin [nome].
Não altere código fora do escopo. Rode npm run typecheck ao final.
```

### Novo plugin

```
Crie plugin "inventario" com listagem CRUD básica.
Siga labflow-plugin: manifest, actions, page, rota em app/(app), registro em index.ts,
ícone em nav-icons.tsx e chaves inventario:view/create/edit/delete em permissions-seed.ts.
```

### IA / RAG

```
Artigos novos não aparecem no assistente.
Verifique se knowledge/actions.ts emite article.created e se bootstrap.ts tem o subscriber.
```

### Investigação antes de mudar

```
Explique como [funcionalidade] funciona hoje, citando arquivos e linhas.
Não edite nada ainda.
```

## Checklist antes de commit

1. `npm run typecheck` — sem erros (**não há testes automatizados; este é o portão**)
2. `npm run build` — valida o grafo completo (`npm run lint` não está configurado neste repo)
3. Mutations emitem eventos (`emit`)
4. Permissões verificadas (`hasPermission` / `requirePermission`) na action **e** gate na UI
5. Plugin registrado em `index.ts` + ícone em `nav-icons.tsx`, se aplicável
6. Mudou arquitetura? Atualize `AGENTS.md`, `docs/ARCHITECTURE.md` e `src/lib/docs-seed.ts`

## Erros comuns de agentes neste repo

| Sintoma | Causa provável |
|---------|----------------|
| Rota nova acessível sem login | Criada fora de `src/app/(app)/` — não há middleware de auth |
| Item não aparece na sidebar | Filtros de visibilidade em `src/app/(app)/layout.tsx`, não o manifest |
| Conteúdo não chega ao assistente | Falta `emit()` na action, não o RAG |
| `/api/v1/<id>/...` responde 404 | Handlers ausentes de `API_REGISTRATIONS`, ou plugin desabilitado |
| Erro de serialização React | Objeto do Prisma passado direto a um client component |
| Campo JSON quebrando | `JSON.parse` cru em vez do helper de parse do módulo |

## Configuração local

```bash
cp .env.example .env
npm run setup
npm run dev
```

Para IA local com Ollama: `AI_PROVIDER=ollama` no `.env`.

## Documentação na plataforma

Após `npm run setup`, artigos de desenvolvimento são criados automaticamente na base de
conhecimento (`src/lib/docs-seed.ts`). Consulte pelo menu **Biblioteca** ou pelo **Assistente IA**.
