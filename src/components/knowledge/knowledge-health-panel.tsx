"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Info, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { getKnowledgeHealthAction } from "@/plugins/knowledge/actions";
import type { HealthReport } from "@/plugins/knowledge/health";

export function KnowledgeHealthPanel({ initial }: { initial: HealthReport | null }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<HealthReport | null>(initial);
  const [pending, start] = useTransition();

  function refresh() {
    start(async () => setReport(await getKnowledgeHealthAction()));
  }

  if (!report && !open) {
    return (
      <Card className="mb-4 p-3">
        <button type="button" onClick={() => { setOpen(true); refresh(); }} className="text-sm text-muted hover:text-fg">
          Ver painel de saude do vault
        </button>
      </Card>
    );
  }

  const s = report?.summary;

  return (
    <Card className="mb-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Saude do vault</h3>
          {s && (
            <p className="text-xs text-muted">
              {s.missingTitle} sem titulo · {s.noProject} sem projeto · {s.stale} desatualizados · {s.emptyFolders} pastas vazias · {s.drafts} rascunhos
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={refresh}>
            <RefreshCw size={14} /> {pending ? "..." : "Atualizar"}
          </Button>
          <button type="button" onClick={() => setOpen(!open)} className="rounded p-1 text-muted hover:bg-surface2">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && report && (
        <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {report.issues.length === 0 && <p className="text-sm text-muted">Nenhum problema encontrado.</p>}
          {report.issues.slice(0, 30).map((issue, i) => (
            <div key={`${issue.type}-${issue.path ?? issue.articleId ?? i}`} className="flex items-start gap-2 text-xs">
              {issue.severity === "warn" ? (
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              ) : (
                <Info size={13} className="mt-0.5 shrink-0 text-muted" />
              )}
              <span className="text-muted">{issue.message}</span>
            </div>
          ))}
          {report.issues.length > 30 && (
            <p className="text-xs text-muted">+ {report.issues.length - 30} outros itens</p>
          )}
        </div>
      )}
    </Card>
  );
}
