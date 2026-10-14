import { Sparkles } from "lucide-react";
import { listAiTools } from "@/plugins/registry";

/**
 * Reference implementation of a `dashboard.widgets` UI contribution.
 *
 * NOT registered by default: it renders the list of registered AI tool names,
 * which is useful while developing a plugin and pure noise on a real lab's
 * dashboard. See the note in `./index.ts` for how to mount it.
 *
 * Server component (no client hooks) so it renders anywhere a slot is mounted.
 */
export function ExampleWidget() {
  const tools = listAiTools();
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} className="text-brand" />
        <h3 className="text-sm font-semibold">Plugin: Assistente de Tarefas</h3>
      </div>
      <p className="text-xs text-muted">
        Este widget vem de um plugin e demonstra os pontos de extensao. Ferramentas de IA expostas:
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tools.length === 0 && <span className="text-xs text-muted">nenhuma</span>}
        {tools.map((t) => (
          <span key={t.name} className="rounded-md bg-surface2 px-2 py-0.5 font-mono text-[11px]">{t.name}</span>
        ))}
      </div>
    </div>
  );
}
