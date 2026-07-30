"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Select, Label, Card, Badge } from "@/components/ui";
import { updateProjectPaperMeta } from "@/plugins/projects/actions";
import {
  type ProjectPaperMeta,
  PAPER_STATUSES,
  PAPER_STATUS_LABELS,
  PAPER_STATUS_COLORS,
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type PaperStatus,
  type VenueType,
} from "@/lib/projects/paper-meta";
import { ACADEMIC_TEXT_FIELDS } from "@/lib/academic/fields";

export function ProjectPaperPanel({
  projectId,
  writable,
  initial,
}: {
  projectId: string;
  writable: boolean;
  initial: ProjectPaperMeta;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState(initial);
  const [pending, start] = useTransition();
  const [info, setInfo] = useState("");

  function save() {
    start(async () => {
      const res = await updateProjectPaperMeta(projectId, meta);
      setInfo(res.error ?? "Salvo.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Pipeline do artigo</h3>
          <Badge color={PAPER_STATUS_COLORS[meta.status]}>{PAPER_STATUS_LABELS[meta.status]}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select
              value={meta.status}
              disabled={!writable}
              className="w-full"
              onChange={(e) => setMeta({ ...meta, status: e.target.value as PaperStatus })}
            >
              {PAPER_STATUSES.map((s) => (
                <option key={s} value={s}>{PAPER_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tipo de venue</Label>
            <Select
              value={meta.venueType}
              disabled={!writable}
              className="w-full"
              onChange={(e) => setMeta({ ...meta, venueType: e.target.value as VenueType | "" })}
            >
              <option value="">—</option>
              {VENUE_TYPES.map((v) => (
                <option key={v} value={v}>{VENUE_TYPE_LABELS[v]}</option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Venue</Label>
            <Input
              value={meta.venue}
              disabled={!writable}
              onChange={(e) => setMeta({ ...meta, venue: e.target.value })}
            />
          </div>
          <div>
            <Label>DOI</Label>
            <Input value={meta.doi} disabled={!writable} onChange={(e) => setMeta({ ...meta, doi: e.target.value })} />
          </div>
          <div>
            <Label>Editor externo (URL)</Label>
            <Input
              value={meta.externalEditorUrl}
              disabled={!writable}
              onChange={(e) => setMeta({ ...meta, externalEditorUrl: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Abstract</Label>
          <Textarea
            rows={4}
            value={meta.abstract}
            disabled={!writable}
            onChange={(e) => setMeta({ ...meta, abstract: e.target.value })}
          />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Estruturacao metodologica</h3>
        {ACADEMIC_TEXT_FIELDS.filter((f) => f.key !== "notes").map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Textarea
              rows={Math.min(f.rows, 3)}
              value={String(meta[f.key as keyof ProjectPaperMeta] ?? "")}
              disabled={!writable}
              onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <Label>Notas</Label>
          <Textarea
            rows={2}
            value={meta.notes}
            disabled={!writable}
            onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
          />
        </div>
        {writable && (
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar artigo"}</Button>
            {info && <span className="text-xs text-muted">{info}</span>}
          </div>
        )}
      </Card>
    </div>
  );
}
