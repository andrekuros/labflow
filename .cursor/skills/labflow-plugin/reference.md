# LabFlow Plugin — Referencia

## Catalogo de plugins (o que copiar)

| Plugin | ID | Complexidade | Copie quando precisar de |
|--------|-----|--------------|--------------------------|
| planning | `planning` | Baixa (agregador) | Pagina que junta dados de varios modulos; `requires: ["projects"]` |
| feedback | `feedback` | Baixa | Modulo simples + `settingsSchema` |
| reports | `reports` | Media | BI, periodos, settings numericos/booleanos |
| team | `team` | Media | CRUD usuarios, sub-rota `/team/[id]`, API REST |
| publications | `publications` | Alta | Entidade nova, detalhe, links, IA, `src/lib/publications/` |
| knowledge | `knowledge` | Alta | Sync externo, folders, links, templates, health check |
| projects | `projects` | Alta | WBS, artefatos IA, multiplas actions files |
| board | `board` | Media | Drag-and-drop, estado otimista |
| academic | `academic` | Media | Perfil acadêmico, revisao IA |
| example | `labflow.example-task-assistant` | Demo | `aiTools`, `ui` slots, `subscriptions` |

Ordem sugerida para **primeiro plugin**: feedback → reports → team → publications.

## Estrutura de arquivos

```
src/plugins/<id>/
  manifest.ts       # obrigatorio
  actions.ts        # server actions
  page.tsx          # listagem (server component)
  detail-page.tsx   # opcional
  api.ts            # REST handlers (pode ser vazio)
  *.ts              # helpers internos do plugin (ex: sync.ts, templates.ts)

src/components/<id>/
  <id>-client.tsx   # UI principal
  *.tsx             # sub-componentes

src/lib/<id>/       # logica de dominio reutilizavel
  access.ts         # canView / canEdit
  constants.ts      # enums, labels
  form.ts           # parse/serialize form

src/app/(app)/<rota>/
  page.tsx          # reexport do plugin page
  [id]/page.tsx     # reexport do detail-page (opcional)
```

## Template — manifest.ts

```typescript
import type { PluginManifest } from "@/plugins/types";

export const myManifest: PluginManifest = {
  id: "my-module",
  name: "Meu Modulo",
  version: "1.0.0",
  description: "Descricao curta.",
  icon: "Box",
  requires: ["projects"],
  nav: {
    label: "Meu Modulo",
    href: "/my-module",
    icon: "Box",
    order: 55,
    group: "Trabalho",
  },
  apiPrefix: "/api/v1/my-module",
  settingsSchema: [
    {
      key: "enabledFeature",
      label: "Ativar feature X",
      type: "boolean",
      defaultValue: true,
      description: "Tooltip opcional.",
    },
  ],
  defaultSettings: { enabledFeature: true },
  // Opcional — ver plugins/example/
  aiTools: [],
  ui: [],
  subscriptions: [],
  lifecycle: {
    onEnable: async () => {},
    onSettingsChange: async () => {},
  },
};
```

## Template — actions.ts

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { emit } from "@/lib/events";

export type CreateInput = { projectId: string; title: string };

export async function createItem(input: CreateInput): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requirePermission("mymodule:create", input.projectId);
    if (!input.title.trim()) return { error: "Titulo obrigatorio." };

    const item = await prisma.myModel.create({
      data: { title: input.title.trim(), projectId: input.projectId },
    });

    await emit({
      type: "project.updated", // ou tipo novo em events.ts
      actorId: user.id,
      projectId: input.projectId,
      targetId: item.id,
      payload: { id: item.id, title: item.title },
    });

    revalidatePath("/my-module");
    return { id: item.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar." };
  }
}
```

## Template — page.tsx

```typescript
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds } from "@/lib/projects";
import { PageHeader, EmptyState } from "@/components/ui";
import { MyClient } from "@/components/my-module/my-client";

export default async function MyPluginPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await requireUser();
  const { project: projectParam } = await searchParams;
  const projectIds = await viewableProjectIds(session);

  if (projectIds.length === 0) {
    return (
      <EmptyState
        title="Nenhum projeto"
        description="Participe de um projeto para usar este modulo."
      />
    );
  }

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { name: "asc" },
    select: { id: true, key: true, name: true, color: true },
  });

  const selectedId =
    projectParam && projectIds.includes(projectParam) ? projectParam : projectIds[0];

  const items = await prisma.myModel.findMany({
    where: { projectId: selectedId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Meu Modulo" description="..." />
      <MyClient
        projects={projects}
        selectedProjectId={selectedId}
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          projectId: i.projectId,
        }))}
      />
    </div>
  );
}
```

## Template — api.ts

Implemente CRUD do recurso primario quando o plugin precisar de integracao externa. Auth da API e **Bearer only** (`lf_...` ou JWT). `runWithApiUser` faz `getSession()` ver o usuario da chave.

Catalogo runtime: `GET /api/v1` → `listRegisteredApiRoutes()`.

```typescript
import { jsonOk, jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { hasPermission } from "@/lib/rbac";
import { createItem } from "@/plugins/my-module/actions";
import { prisma } from "@/lib/db";

export const handlers: PluginApiHandlers = {
  "GET items": async (ctx) => {
    if (!(await hasPermission(ctx.user, "mymodule:view"))) {
      return jsonError("Sem permissao", 403);
    }
    const rows = await prisma.myModel.findMany({ take: 50 });
    return jsonOk(rows);
  },

  "POST items": async (ctx, body) => {
    if (!(await hasPermission(ctx.user, "mymodule:create"))) {
      return jsonError("Sem permissao", 403);
    }
    const input = body as { title?: string };
    if (!input?.title) return jsonError("title obrigatorio");
    return runApiAction(() => createItem({ title: input.title! }));
  },

  "GET items/:id": async (ctx) => {
    if (!(await hasPermission(ctx.user, "mymodule:view"))) {
      return jsonError("Sem permissao", 403);
    }
    const row = await prisma.myModel.findUnique({ where: { id: ctx.params.id } });
    if (!row) return jsonError("Nao encontrado", 404);
    return jsonOk(row);
  },
};
```

Chaves sem depender de barra inicial (`"GET items"`). Paths com `:param` sao suportados.

## Template — client component

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { createItem } from "@/plugins/my-module/actions";

type Props = {
  projects: { id: string; key: string; name: string; color: string }[];
  selectedProjectId: string;
  items: { id: string; title: string; projectId: string }[];
};

export function MyClient({ projects, selectedProjectId, items }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onCreate() {
    setError(null);
    start(async () => {
      const res = await createItem({ projectId: selectedProjectId, title: "Novo item" });
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={onCreate} disabled={pending}>Criar</Button>
      <ul>{items.map((i) => <li key={i.id}>{i.title}</li>)}</ul>
    </Card>
  );
}
```

## Registro em index.ts

```typescript
// Adicionar imports
import { myManifest } from "@/plugins/my-module/manifest";
import { handlers as myApi } from "@/plugins/my-module/api";

// BUILTIN_PLUGINS — ordem afeta seed, nao nav (nav usa order)
const BUILTIN_PLUGINS = [
  // ...existentes
  myManifest,
];

// API_REGISTRATIONS
const API_REGISTRATIONS = [
  // ...existentes
  ["my-module", myApi],
];
```

## Registro em nav-icons.tsx

```typescript
import { Box } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  // ...existentes
  Box,
};
```

O `manifest.nav.icon` e `manifest.icon` devem usar o mesmo nome da chave em `ICONS`.

## Permissoes — permissions-seed.ts

```typescript
// Em PERMISSIONS array:
{ key: "mymodule:view", description: "Visualizar meu modulo", module: "mymodule", action: "view" },
{ key: "mymodule:create", description: "Criar itens", module: "mymodule", action: "create" },
{ key: "mymodule:edit", description: "Editar itens", module: "mymodule", action: "edit" },
{ key: "mymodule:delete", description: "Excluir itens", module: "mymodule", action: "delete" },

// Em ROLE_PERMISSIONS — adicionar chaves aos roles apropriados:
researcher: [..., "mymodule:view", "mymodule:create", "mymodule:edit"],
viewer: [..., "mymodule:view"],
```

Admin sempre passa em `hasPermission`. Lead de projeto herda `project_manager` no escopo do projeto.

## Sub-rota de detalhe

```typescript
// src/plugins/my-module/detail-page.tsx
export default async function MyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // load + permission check
}

// src/app/(app)/my-module/[id]/page.tsx
import DetailPage from "@/plugins/my-module/detail-page";
export default DetailPage;
```

## Prisma — modelo novo

1. Adicionar model em `prisma/schema.prisma`
2. `npx prisma db push` (dev) ou migration em prod
3. Seed opcional em `prisma/seed.ts`
4. Enums no Prisma sao `String` — usar constantes em `src/lib/<id>/constants.ts`

## Eventos e RAG

Novo tipo de evento:

1. Adicionar em `DomainEventType` (`src/lib/events.ts`)
2. `emit()` na action apos mutation
3. Se indexar no assistente: subscriber em `src/server/bootstrap.ts`

```typescript
on("mymodule.updated", (e) => void indexMyEntity(e.payload?.id as string));
```

## Extension points avancados

### aiTools (assistente)

Ver `src/plugins/example/index.ts`. Ferramentas registradas via manifest; agente chama via `listAiTools()`.

### UI slots

| Slot | Uso |
|------|-----|
| `dashboard.widgets` | Card no dashboard |
| `sidebar.nav` | Item extra na sidebar |
| `project.tabs` | Aba na pagina do projeto |
| `task.panel` | Painel lateral na tarefa |

### subscriptions

Reagir a eventos sem alterar `bootstrap.ts`:

```typescript
subscriptions: [
  { event: "task.created", handler: async (e) => { /* ... */ } },
],
```

### lifecycle

`onEnable`, `onDisable`, `onSettingsChange` — inicializar caches, agendar jobs.

### requires

```typescript
requires: ["projects", "knowledge"],
```

Plugin so aparece habilitado se dependencias estiverem ativas.

## Integracao cross-plugin

| Padrao | Onde ver |
|--------|----------|
| Artigo wiki linkado a entidade | `KnowledgeLink`, `knowledge/link-actions.ts` |
| Publicacao linkada a task/req | `plugins/publications/actions.ts` (links) |
| Settings de outro plugin | `getPluginSettings("roadmap")` em planning |
| Artefatos IA | `src/lib/artifacts/*`, `plugins/projects/` |
| Permissao de conhecimento | `src/lib/knowledge-access.ts` |

## Anti-patterns

- Client component importando Prisma ou `src/lib/db`
- Hardcodar roles (`user.role === "researcher"`) em vez de `hasPermission`
- Esquecer `revalidatePath` apos mutation em server page
- Criar plugin novo quando a feature pertence a modulo existente
- `api.ts` sem checar permissao em cada handler
- Icone no manifest sem entrada em `nav-icons.tsx` (cai no icone Puzzle)
