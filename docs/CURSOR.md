# LabFlow — Guia de uso com Cursor

Como usar o Cursor (e outros agentes de IA) de forma eficiente neste repositório.

## Arquivos de contexto

| Arquivo | Para quem | Conteúdo |
|---------|-----------|----------|
| `AGENTS.md` | Agentes de IA | Arquitetura, módulos, convenções |
| `.cursor/rules/*.mdc` | Cursor (automático) | Regras por escopo de arquivo |
| `.cursor/skills/*/SKILL.md` | Cursor (sob demanda) | Workflows específicos |
| `README.md` | Humanos | Instalação e uso da plataforma |

## Skills do projeto

Mencione ou invoque estas skills no chat do Cursor:

| Skill | Quando usar |
|-------|-------------|
| `labflow-dev` | Desenvolvimento geral, bugfix, refatoração |
| `labflow-plugin` | Criar ou alterar módulos/plugins |
| `labflow-ai` | RAG, assistente, embeddings, artefatos IA |

Exemplo de prompt:

> Use a skill labflow-plugin para adicionar um campo "prioridade" no módulo de entregáveis.

## Regras automáticas

O Cursor carrega regras de `.cursor/rules/`:

- **labflow-core** — sempre ativa (stack, padrões gerais)
- **labflow-plugins** — ao editar `src/plugins/**`
- **labflow-server-actions** — ao editar `**/actions.ts`

## Prompts eficazes

### Bugfix

```
Corrija [descrição]. Leia AGENTS.md e o plugin [nome].
Não altere código fora do escopo. Rode typecheck ao final.
```

### Novo plugin

```
Crie plugin "inventario" com listagem CRUD básica.
Siga labflow-plugin: manifest, actions, page, rota, registro em index.ts.
Permissões: inventario:view/create/edit/delete.
```

### IA / RAG

```
Artigos novos não aparecem no assistente.
Verifique eventos emitidos em knowledge/actions.ts e bootstrap.ts.
```

## Checklist antes de commit

1. `npm run typecheck` — sem erros
2. `npm run lint` — sem erros novos
3. Mutations emitem eventos (`emit`)
4. Permissões verificadas (`hasPermission` ou `requirePermission`)
5. Plugin registrado em `index.ts` se aplicável

## Configuração local

```bash
cp .env.example .env
npm run setup
npm run dev
```

Para IA local com Ollama: `AI_PROVIDER=ollama` no `.env`.

## Documentação na plataforma

Após `npm run setup`, artigos de desenvolvimento são criados automaticamente na base de conhecimento (`docs-seed.ts`). Consulte pelo menu **Conhecimento** ou pelo **Assistente IA**.
