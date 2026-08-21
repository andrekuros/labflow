"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card, Badge, Select } from "@/components/ui";
import { setVerificationStatus } from "@/plugins/verification/actions";
import { VV_METHOD, VV_STATUS } from "@/lib/se/constants";
import { KnowledgeLinksPanel } from "@/components/knowledge/knowledge-links";

type Case = {
  id: string;
  name: string;
  method: string;
  status: string;
  projectId: string;
  requirement: { id: string; code: string | null; title: string };
  project: { key: string; color: string };
};

export function VerificationClient({ cases, canWrite }: { cases: Case[]; canWrite: Record<string, boolean> }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const byReq = new Map<string, Case[]>();
  for (const c of cases) {
    const list = byReq.get(c.requirement.id) ?? [];
    list.push(c);
    byReq.set(c.requirement.id, list);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto p-4">
        <h3 className="mb-3 text-sm font-semibold">Matriz de verificacao</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-3">Requisito</th>
              <th className="py-2 pr-3">Caso V&V</th>
              <th className="py-2 pr-3">Metodo</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Evidencia</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-muted">Nenhum caso de verificacao.</td></tr>
            )}
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  <Badge color={c.project.color}>{c.project.key}</Badge>
                  <span className="ml-1">{c.requirement.code ?? ""} {c.requirement.title}</span>
                </td>
                <td className="py-2 pr-3">{c.name}</td>
                <td className="py-2 pr-3">{VV_METHOD[c.method] ?? c.method}</td>
                <td className="py-2">
                  <Select
                    value={c.status}
                    disabled={pending || !canWrite[c.projectId]}
                    onChange={(e) => start(async () => { await setVerificationStatus(c.id, e.target.value); router.refresh(); })}
                    className="h-8 text-xs"
                  >
                    {Object.entries(VV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </td>
                <td className="min-w-[220px] py-2 align-top">
                  <KnowledgeLinksPanel
                    targetType="verification"
                    targetId={c.id}
                    projectId={c.projectId}
                    canEdit={Boolean(canWrite[c.projectId])}
                    compact
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
