---
name: labflow-dev
description: Desenvolvimento geral no LabFlow (Next.js, Prisma, RBAC, eventos). Use para bugfixes, features em módulos existentes, refatoração ou quando o usuário pedir ajuda com o código LabFlow sem criar plugin novo.
---

# LabFlow — Desenvolvimento Geral

## Antes de editar

1. Ler `AGENTS.md` (mapa de módulos e arquitetura)
2. Identificar o plugin ou `src/lib/` responsável
3. Verificar permissões em `permissions-seed.ts` se a feature envolve acesso

## Fluxo de trabalho

```
1. Localizar código (plugin actions, lib, components)
2. Implementar mudança mínima
3. emit() após mutations
4. revalidatePath se necessário
5. npm run typecheck
```

## Onde buscar

| Necessidade | Local |
|-------------|-------|
| Auth/sessão | `src/lib/auth.ts` |
| Permissões | `src/lib/rbac.ts`, `permissions-seed.ts` |
| Projetos visíveis | `src/lib/projects.ts` |
| Eventos | `src/lib/events.ts`, `server/bootstrap.ts` |
| UI compartilhada | `src/components/ui/` |
| Settings globais | `src/app/actions/settings.ts`, settings client |
| Schema DB | `prisma/schema.prisma` |

## Padrões UI

- Server page busca dados → passa props ao client component
- Client: `"use client"`, sem importar Prisma
- Formulários: server actions via `formAction` ou `startTransition`
- Markdown: `src/components/markdown/markdown-view.tsx`

## Teste local

```bash
npm run dev
# login: admin@lab.edu / admin123
```

## Não fazer

- Commit/push sem pedido explícito
- Criar arquivos de doc não solicitados além do escopo
- Alterar seed ou schema sem necessidade da tarefa
