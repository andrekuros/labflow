import { requireUser } from "@/lib/rbac";
import { bootstrap } from "@/server/bootstrap";
import { listPlugins } from "@/plugins/registry";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { Puzzle, Wrench, LayoutGrid, Radio } from "lucide-react";

export default async function PluginsPage() {
  await requireUser();
  bootstrap();
  const plugins = listPlugins();

  return (
    <div>
      <PageHeader
        title="Plugins"
        description="Modulos que estendem a plataforma sem alterar o nucleo (eventos, ferramentas de IA e slots de UI)."
      />

      {plugins.length === 0 ? (
        <EmptyState title="Nenhum plugin" description="Plugins registrados aparecem aqui." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plugins.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand"><Puzzle size={18} /></div>
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="font-mono text-[11px] text-muted">{p.id}</p>
                  </div>
                </div>
                <Badge color="#22c55e">v{p.version} - ativo</Badge>
              </div>
              {p.description && <p className="text-sm text-muted">{p.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-surface2 px-2 py-1"><Wrench size={12} /> {p.aiTools?.length ?? 0} ferramentas IA</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-surface2 px-2 py-1"><LayoutGrid size={12} /> {p.ui?.length ?? 0} contribuicoes UI</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-surface2 px-2 py-1"><Radio size={12} /> {p.subscriptions?.length ?? 0} eventos</span>
              </div>
              {p.aiTools && p.aiTools.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-[11px] font-medium text-muted">Ferramentas de IA:</p>
                  {p.aiTools.map((t) => (
                    <p key={t.name} className="text-xs"><span className="font-mono">{t.name}</span> - {t.description}</p>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 p-5">
        <h2 className="mb-2 text-sm font-semibold">Como criar um plugin</h2>
        <p className="text-sm text-muted">
          Um plugin e um manifesto (<span className="font-mono text-xs">PluginManifest</span>) que declara assinaturas de eventos,
          ferramentas de IA e componentes de UI. Registre-o em <span className="font-mono text-xs">src/plugins/index.ts</span>.
          O nucleo nao precisa ser alterado.
        </p>
      </Card>
    </div>
  );
}
