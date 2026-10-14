# CLAUDE.md

Este projeto usa **[AGENTS.md](AGENTS.md)** como guia canônico para agentes de IA. Leia-o antes de editar código.

## Leitura mínima

| Ordem | Arquivo | Por quê |
|-------|---------|---------|
| 1 | [AGENTS.md](AGENTS.md) | Arquitetura, plugins registrados, convenções, receitas por tarefa, armadilhas |
| 2 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Diagramas de camadas, ciclo de vida de request, modelo de dados |
| 3 | [README.md](README.md) | Instalação, `.env`, scripts |

## O essencial

- **Tudo é plugin.** Features vivem em `src/plugins/<id>/`, não no núcleo. Registre em `src/plugins/index.ts`.
- **Autentique sempre.** Não há middleware: use `requireUser()` / `requirePermission("modulo:acao", projectId)` em toda action e rota nova.
- **Emita eventos.** Após create/update/delete, chame `emit()` — é o que alimenta activity log, RAG e agentes.
- **Prisma:** enums são `String`, JSON é `String` — use os helpers de parse.
- **Portão de qualidade:** não há testes automatizados nem ESLint configurado (`npm run lint` abre um prompt interativo). Use typecheck, e build para o grafo completo.

```bash
npm run typecheck
```

## Escopo

Mudanças mínimas e focadas. Não refatore código fora da tarefa, não altere `prisma/seed.ts` ou o schema sem necessidade, e não faça commit ou push sem pedido explícito.
