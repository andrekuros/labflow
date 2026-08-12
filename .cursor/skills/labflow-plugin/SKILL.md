---
name: labflow-plugin
description: >-
  Desenvolve plugins LabFlow do zero ou estende modulos existentes (manifest,
  actions, page, api, permissoes, eventos, aiTools). Use ao criar modulo novo,
  adicionar feature a plugin existente, registrar nav/API/settings ou reutilizar
  padroes de projects, knowledge, reports, publications.
---

# LabFlow — Desenvolvimento de Plugins

Leia `AGENTS.md` para o mapa geral. Este skill cobre o fluxo pratico de criar ou estender plugins.

## Decisao rapida

| Objetivo | Caminho |
|----------|---------|
| Modulo novo com rota propria | **Novo plugin** → checklist abaixo |
| Feature em modulo existente | Editar `src/plugins/<id>/` + `src/components/<id>/` |
| So REST externo | `api.ts` + registro em `index.ts` |
| Ferramenta para o assistente | `aiTools` no manifest (ver `plugins/example/`) |
| Widget ou aba extra | `ui` slot no manifest |
| Reagir a mudancas no sistema | `subscriptions` ou subscriber em `bootstrap.ts` |

Antes de codar: **encontre o plugin mais parecido** na tabela de referencia e copie a estrutura dele.

## Checklist — novo plugin

```
- [ ] Escolher plugin de referencia (ver reference.md)
- [ ] src/plugins/<id>/manifest.ts
- [ ] src/plugins/<id>/actions.ts
- [ ] src/plugins/<id>/page.tsx
- [ ] src/plugins/<id>/api.ts (handlers vazios se nao precisar REST)
- [ ] src/components/<id>/*-client.tsx (UI interativa)
- [ ] src/app/(app)/<rota>/page.tsx (reexport fino)
- [ ] src/app/(app)/<rota>/[id]/page.tsx (se tiver detalhe)
- [ ] Registro em src/plugins/index.ts (BUILTIN_PLUGINS + API_REGISTRATIONS)
- [ ] Icone em src/plugins/nav-icons.tsx
- [ ] Permissoes em src/lib/permissions-seed.ts (modulo:view|create|edit|delete)
- [ ] Model Prisma se persistir dados novos
- [ ] src/lib/<id>/ (logica reutilizavel: access, constants, form)
- [ ] emit() apos mutations + tipo em src/lib/events.ts se novo
- [ ] npm run typecheck
```

## Fluxo em 7 passos

### 1. Manifest

```typescript
// src/plugins/<id>/manifest.ts
import type { PluginManifest } from "@/plugins/types";

export const myManifest: PluginManifest = {
  id: "my-module",           // = segmento da API /api/v1/my-module
  name: "Meu Modulo",
  version: "1.0.0",
  description: "...",
  icon: "Box",               // nome Lucide (mesmo em nav.icon)
  requires: ["projects"],    // plugins que devem estar habilitados
  nav: {
    label: "Meu Modulo",
    href: "/my-module",
    icon: "Box",
    order: 50,
    group: "Trabalho",       // Trabalho | Conhecimento | Equipe | Gestao | Administracao
  },
  apiPrefix: "/api/v1/my-module",
  settingsSchema: [],        // opcional — aparece em Configuracoes
  defaultSettings: {},
};
```

Grupos de `order` usados hoje: projetos ~10–20, planejamento ~35, conhecimento ~60–72, gestao ~80, admin ~88.

### 2. Server page (busca dados)

Padrao: `requireUser()` → filtrar por projetos visiveis → passar props serializaveis ao client.

```typescript
// src/plugins/<id>/page.tsx
import { requireUser } from "@/lib/rbac";
import { viewableProjectIds } from "@/lib/projects";
import { MyClient } from "@/components/my-module/my-client";

export default async function MyPluginPage() {
  const session = await requireUser();
  const projectIds = await viewableProjectIds(session);
  // prisma queries...
  return <MyClient sessionId={session.id} projects={projects} items={items} />;
}
```

Sub-rota de detalhe: `detail-page.tsx` no plugin + `src/app/(app)/<rota>/[id]/page.tsx` reexportando.

### 3. Actions (mutations)

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { emit } from "@/lib/events";
import { prisma } from "@/lib/db";

export async function createThing(input: { projectId: string; title: string }) {
  const user = await requirePermission("mymodule:create", input.projectId);
  const row = await prisma.thing.create({ data: { ...input } });
  await emit({
    type: "thing.created",   // adicionar em DomainEventType se novo
    actorId: user.id,
    projectId: input.projectId,
    targetId: row.id,
    payload: { id: row.id },
  });
  revalidatePath("/my-module");
  return { id: row.id };
}
```

Retornar `{ error: string }` para erros esperados na UI. Logica complexa vai em `src/lib/<id>/`, nao na action.

### 4. Client component

- `"use client"` em `src/components/<id>/`
- Importa actions do plugin; **nunca** importa Prisma
- Usa `src/components/ui/` (Card, Button, PageHeader, EmptyState, Badge)
- Formularios: `useTransition` + server action

### 5. Rota App Router (wrapper fino)

```typescript
// src/app/(app)/my-module/page.tsx
import MyPluginPage from "@/plugins/my-module/page";
export default MyPluginPage;
```

### 6. Registro

Em `src/plugins/index.ts`:
- import manifest → `BUILTIN_PLUGINS`
- import handlers → `API_REGISTRATIONS` (mesmo se `handlers = {}`)

Em `src/plugins/nav-icons.tsx`: adicionar icone Lucide ao mapa `ICONS`.

### 7. Permissoes

Em `src/lib/permissions-seed.ts`:
- chaves `mymodule:view`, `mymodule:create`, `mymodule:edit`, `mymodule:delete`
- atribuir aos roles em `ROLE_PERMISSIONS`

Na action: `requirePermission("mymodule:edit", projectId)` ou `hasPermission(user, "mymodule:view")`.

## Reutilizar plugins existentes

Nao reinventar — **importar ou espelhar** o que ja existe:

| Precisa de | Reutilize de |
|------------|--------------|
| Escopo por projeto | `viewableProjectIds`, `writableMap` (`src/lib/projects.ts`) |
| CRUD com RBAC | `plugins/requirements/`, `plugins/deliverables/` |
| Listagem + detalhe | `plugins/publications/`, `plugins/team/` |
| Agregador multi-modulo | `plugins/planning/` (le settings de outros via `getPluginSettings`) |
| Settings admin | `plugins/reports/`, `plugins/feedback/` |
| Sync externo + health | `plugins/knowledge/` |
| Links wiki ↔ entidade | `plugins/knowledge/link-actions.ts`, model `KnowledgeLink` |
| IA + drafts | `plugins/projects/` (artefatos), `plugins/publications/` |
| Eventos + RAG | `server/bootstrap.ts` subscribers |
| API REST | `plugins/board/api.ts`, `plugins/knowledge/api.ts`, `plugins/projects/api.ts` |
| Todos os extension points | `plugins/example/index.ts` |

Logica de dominio compartilhada: `src/lib/<dominio>/` (ex.: `publications/access.ts`, `knowledge-access.ts`).

## API REST

Implemente ou atualize `api.ts` quando o modulo precisar de integracao externa / automacao. Padrao: **CRUD do recurso primario** (`list` / `get` / `create` / `update` / `delete` onde houver action) + ops especiais. Nao espelhe fluxos niche so de UI (WBS move, drafts, PDF).

Checklist REST:

```
- [ ] Handlers em api.ts com chaves "METHOD path" (sem depender de barra inicial)
- [ ] hasPermission / runApiAction em cada handler
- [ ] Preferir chamar actions existentes (ALS runWithApiUser ja injeta o Bearer user em getSession)
- [ ] Registrar em API_REGISTRATIONS (index.ts)
- [ ] Rotas aparecem em GET /api/v1 (listRegisteredApiRoutes)
```

```typescript
// src/plugins/<id>/api.ts
import { jsonOk, jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { hasPermission } from "@/lib/rbac";
import { createThing } from "@/plugins/my-module/actions";

export const handlers: PluginApiHandlers = {
  "GET items": async (ctx) => {
    if (!(await hasPermission(ctx.user, "mymodule:view"))) {
      return jsonError("Sem permissao", 403);
    }
    return jsonOk({ items: [] });
  },
  "POST items": async (ctx, body) => {
    if (!(await hasPermission(ctx.user, "mymodule:create"))) {
      return jsonError("Sem permissao", 403);
    }
    return runApiAction(() => createThing(body as { title: string }));
  },
  "PATCH items/:id": async (ctx, body) => {
    // ctx.params.id, ctx.user, ctx.request
    return jsonOk({ updated: true });
  },
};
```

- Chave: `"METHOD path"` ou `"METHOD path/:param"` (barra inicial e opcional; o registry normaliza).
- URL: `/api/v1/<pluginId>/items`
- Auth: **`Authorization: Bearer lf_...`** ou JWT (`plugins/api-auth.ts`). Cookie de sessao do browser tambem autentica (ex.: abrir `/api/v1` logado).
- Catalogo: `GET /api/v1` (autenticado) lista todas as rotas registradas.
- Docs usuario: artigo Knowledge "LabFlow — API REST" + Settings > Integracoes.

## Extensao sem rota nova

Estender plugin existente em vez de criar um novo quando a feature pertence ao mesmo dominio:

1. Novas actions em `plugins/<id>/actions.ts`
2. UI em `components/<id>/`
3. Novo evento em `events.ts` + `emit()` se outros modulos precisam reagir
4. `aiTools` ou `ui` slot no manifest se integrar ao assistente/dashboard

## Settings de plugin

`settingsSchema` no manifest → admin edita em Configuracoes. Ler em runtime:

```typescript
import { getPluginSettings } from "@/plugins/registry";
const cfg = getPluginSettings("reports");
const days = Number(cfg.reportPeriodDays ?? 14);
```

## Verificacao

```bash
npm run typecheck
npm run dev   # admin@lab.edu / admin123
```

Confirmar: item na sidebar, pagina carrega, mutation emite evento, permissao nega usuario viewer.

## Recursos

- Templates completos e catalogo de plugins: [reference.md](reference.md)
- Arquitetura geral: `AGENTS.md`
- Regras Cursor: `.cursor/rules/labflow-plugins.mdc`, `labflow-server-actions.mdc`
- IA/RAG: skill `labflow-ai`
- Bugfix fora de plugin: skill `labflow-dev`
