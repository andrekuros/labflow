"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { Button, Card, Textarea, Label } from "@/components/ui";
import { exportProjectJson, importProjectJson } from "@/plugins/projects/conops-actions";

export function ArtifactsIo({ projectId, writable }: { projectId: string; writable: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold">Exportar / Importar artefatos</h2>
      <p className="mb-3 text-xs text-muted">JSON no formato LabFlow v1.0 — compativel com IAs externas.</p>

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              try {
                const text = await exportProjectJson(projectId);
                const blob = new Blob([text], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `labflow-artifacts-${projectId.slice(0, 8)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao exportar");
              }
            })
          }
        >
          <Download size={14} /> Exportar JSON
        </Button>

        {writable && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setJson(String(reader.result ?? ""));
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Carregar arquivo
            </Button>
          </>
        )}
      </div>

      {writable && (
        <div className="mt-3 space-y-2">
          <Label>JSON para importar (cria rascunhos para revisao)</Label>
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={5}
            placeholder='{"version":"1.0","requirements":[...]}'
            className="font-mono text-xs"
          />
          <Button
            size="sm"
            disabled={pending || !json.trim()}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const n = await importProjectJson(projectId, json);
                  setJson("");
                  router.refresh();
                  if (n === 0) setError("Nenhum artefato no JSON");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Erro ao importar");
                }
              })
            }
          >
            Importar como rascunhos
          </Button>
        </div>
      )}
    </Card>
  );
}
