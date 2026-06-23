"use client";

import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { REQ_LEVEL } from "@/lib/se/constants";

type Req = {
  id: string;
  code: string | null;
  title: string;
  level: string;
  project: { key: string; color: string };
  activities: { id: string; name: string }[];
  deliverables: { id: string; name: string }[];
  verificationCases: { id: string; name: string; status: string }[];
  allocatedTo: { id: string; name: string } | null;
};

export function TraceabilityMatrix({ requirements }: { requirements: Req[] }) {
  return (
    <Card className="mb-6 overflow-x-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Matriz de rastreabilidade</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-3">Requisito</th>
            <th className="py-2 pr-3">Nivel</th>
            <th className="py-2 pr-3">Alocado em</th>
            <th className="py-2 pr-3">Atividades</th>
            <th className="py-2 pr-3">Entregaveis</th>
            <th className="py-2">V&V</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((r) => (
            <tr key={r.id} className="border-b border-border/60 align-top">
              <td className="py-2 pr-3">
                <Badge color={r.project.color}>{r.project.key}</Badge>
                <span className="ml-1 font-medium">{r.code ? `${r.code} ` : ""}{r.title}</span>
              </td>
              <td className="py-2 pr-3 text-muted">{REQ_LEVEL[r.level] ?? r.level}</td>
              <td className="py-2 pr-3">{r.allocatedTo?.name ?? "—"}</td>
              <td className="py-2 pr-3">{r.activities.map((a) => a.name).join(", ") || "—"}</td>
              <td className="py-2 pr-3">{r.deliverables.map((d) => d.name).join(", ") || "—"}</td>
              <td className="py-2">
                {r.verificationCases.length === 0 ? "—" : (
                  <Link href="/verification" className="text-brand hover:underline">
                    {r.verificationCases.filter((v) => v.status === "passed").length}/{r.verificationCases.length} ok
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
