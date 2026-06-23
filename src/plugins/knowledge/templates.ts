import "server-only";
import { ensurePath, putFile } from "@/plugins/knowledge/nextcloud-client";
import type { NextcloudConnection } from "@/plugins/knowledge/nextcloud-client";
import { TEMPLATE_CATALOG, type TemplateKey } from "@/plugins/knowledge/templates-catalog";

export type { TemplateKey };
export { TEMPLATE_CATALOG };

const TEMPLATE_CONTENT: Record<TemplateKey, (title: string) => string> = {
  protocolo: (title) => `---
title: ${title}
status: draft
tags: protocolo
---

# ${title}

## Objetivo

## Materiais

## Procedimento

1.

## Criterios de exclusao

## Referencias
`,
  equipamento: (title) => `---
title: ${title}
status: active
tags: equipamento
---

# ${title}

## Identificacao

- Modelo:
- Numero de serie:
- Local:

## Calibracao

- Ultima calibracao:
- Proxima calibracao:

## Manutencao

## Notas
`,
  "nota-projeto": (title) => `---
title: ${title}
status: draft
project:
tags: projeto
---

# ${title}

## Contexto

## Decisoes

## Proximos passos
`,
  relatorio: (title) => `---
title: ${title}
status: draft
tags: relatorio
---

# ${title}

## Resumo

## Metodos

## Resultados

## Conclusao
`,
};

export async function createNextcloudTemplate(
  conn: NextcloudConnection,
  templateKey: TemplateKey,
  targetFolder: string,
  title: string,
): Promise<{ ok: boolean; path: string; message: string }> {
  const tpl = TEMPLATE_CATALOG[templateKey];
  if (!tpl) return { ok: false, path: "", message: "Template desconhecido" };

  const folder = targetFolder.replace(/^\/+|\/+$/g, "");
  const safeName = tpl.filename.replace(/\.md$/, `-${Date.now()}.md`);
  const relativePath = folder ? `${folder}/${safeName}` : safeName;

  await ensurePath(conn, folder);
  await putFile(conn, relativePath, TEMPLATE_CONTENT[templateKey](title || tpl.label));

  return { ok: true, path: relativePath, message: `Criado: ${relativePath}` };
}
