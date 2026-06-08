import { Sparkles } from "lucide-react";
import { listAiTools } from "@/plugins/registry";

/**
 * Example UI contribution rendered into the "dashboard.widgets" slot.
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
