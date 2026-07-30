"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save } from "lucide-react";
import { Button, Card, Textarea, Label, Badge, Select } from "@/components/ui";
import { saveConops, generateArtifactsWithAi, type GenerateResult } from "@/plugins/projects/conops-actions";
import type { ConopsData, ArtifactType } from "@/lib/artifacts/schema";
import { ARTIFACT_TYPES } from "@/lib/artifacts/schema";
import type { ArtifactCounts } from "@/lib/artifacts/existing-summary";

const FIELDS: { key: keyof ConopsData; label: string; rows: number }[] = [
  { key: "mission", label: "Missao", rows: 2 },
  { key: "scope", label: "Escopo", rows: 2 },
  { key: "stakeholders", label: "Stakeholders", rows: 2 },
  { key: "operatingEnvironment", label: "Ambiente operacional", rows: 2 },
  { key: "conceptOfOperations", label: "Conceito de operacoes (CONOPS)", rows: 4 },
  { key: "constraints", label: "Restricoes", rows: 2 },
  { key: "successCriteria", label: "Criterios de sucesso", rows: 2 },
  { key: "assumptions", label: "Premissas", rows: 2 },
];

const TYPE_LABELS: Record<ArtifactType, string> = {
  requirement: "Requisitos",
  task: "Tarefas",
  deliverable: "Entregaveis",
  work_package: "Atividades WBS",
  milestone: "Marcos",
  system_element: "Elementos do sistema",
  verification_case: "Casos V&V",
  sprint_plan: "Plano de sprint",
};

type GenerationMode = "complement" | "replace_pending" | "append";

const MODE_LABELS: Record<GenerationMode, string> = {
  complement: "Complementar (padrao) — evita duplicar existentes",
  replace_pending: "Substituir rascunhos pendentes — descarta pendentes dos tipos selecionados",
  append: "Acrescentar tudo — pode gerar duplicatas",
};

function totalAccepted(counts: ArtifactCounts) {
  return Object.values(counts).reduce((n, c) => n + c.accepted, 0);
}

function totalPending(counts: ArtifactCounts) {
  return Object.values(counts).reduce((n, c) => n + c.pending, 0);
}

export function ConopsPanel({
  projectId,
  initial,
  writable,
  formatDocId,
  artifactCounts,
  defaultArtifactTypes,
}: {
  projectId: string;
  initial: ConopsData;
  writable: boolean;
  formatDocId?: string | null;
  artifactCounts: ArtifactCounts;
  defaultArtifactTypes?: ArtifactType[];
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [types, setTypes] = useState<ArtifactType[]>(
    defaultArtifactTypes?.length ? defaultArtifactTypes : ["requirement", "task", "deliverable", "work_package"],
  );
  const [mode, setMode] = useState<GenerationMode>("complement");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();

  const toggleType = (t: ArtifactType) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const accepted = totalAccepted(artifactCounts);
  const pendingDrafts = totalPending(artifactCounts);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">CONOPS do projeto</h2>
          <p className="text-xs text-muted">Concept of Operations — base para geracao de artefatos com IA.</p>
        </div>
        {formatDocId && (
          <a href={`/knowledge/${formatDocId}`} className="text-xs text-brand hover:underline">
            Ver formato JSON
          </a>
        )}
      </div>

      {(accepted > 0 || pendingDrafts > 0) && (
        <div className="mb-3 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-muted">
          <span className="font-medium text-fg">Artefatos no projeto:</span>{" "}
          {accepted} aceitos · {pendingDrafts} rascunhos pendentes.
          {accepted > 0 && (
            <span className="block mt-1">
              Ao gerar, o modo <strong>Complementar</strong> informa a IA o que ja existe e filtra duplicatas por titulo/codigo.
              Artefatos ja aceitos nunca sao alterados automaticamente.
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Textarea
              value={data[f.key]}
              onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
              rows={f.rows}
              disabled={!writable}
            />
          </div>
        ))}
      </div>

      {writable && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <Label>Gerar artefatos com IA</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ARTIFACT_TYPES.map((t) => {
                const c = artifactCounts[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface2"
                  >
                    <Badge className={types.includes(t) ? "bg-brand/20 text-brand" : "bg-surface2 text-muted"}>
                      {TYPE_LABELS[t]}
                      {(c.accepted > 0 || c.pending > 0) && (
                        <span className="ml-1 opacity-70">({c.accepted}+{c.pending})</span>
                      )}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Quando ja existem artefatos</Label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as GenerationMode)} className="mt-1 w-full text-xs">
              {(Object.keys(MODE_LABELS) as GenerationMode[]).map((m) => (
                <option key={m} value={m}>{MODE_LABELS[m]}</option>
              ))}
            </Select>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {info && <p className="text-xs text-brand">{info}</p>}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  setInfo("");
                  try {
                    await saveConops(projectId, data);
                    router.refresh();
                    setInfo("CONOPS salvo.");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Erro ao salvar");
                  }
                })
              }
            >
              <Save size={14} /> Salvar CONOPS
            </Button>
            <Button
              disabled={pending || types.length === 0}
              onClick={() =>
                start(async () => {
                  setError("");
                  setInfo("");
                  try {
                    await saveConops(projectId, data);
                    const result: GenerateResult = await generateArtifactsWithAi(projectId, types, mode);
                    router.refresh();
                    if (result.created === 0) {
                      setError(
                        result.skipped > 0
                          ? `Nenhum rascunho novo (${result.skipped} duplicata(s) filtrada(s)).`
                          : "Nenhum artefato gerado.",
                      );
                    } else {
                      const parts = [`${result.created} rascunho(s) criado(s)`];
                      if (result.skipped > 0) parts.push(`${result.skipped} duplicata(s) ignorada(s)`);
                      if (result.rejectedPending > 0) parts.push(`${result.rejectedPending} rascunho(s) pendente(s) substituido(s)`);
                      setInfo(parts.join(" · "));
                      router.push(`/projects/${projectId}?tab=review`);
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Erro na geracao");
                  }
                })
              }
            >
              <Sparkles size={14} /> Gerar com IA
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
