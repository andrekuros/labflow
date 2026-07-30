"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Label, Card } from "@/components/ui";
import { updateProjectAcademicMeta } from "@/plugins/projects/actions";
import {
  type ProjectAcademicMeta,
  type AcademicCourse,
  type AcademicPending,
} from "@/lib/projects/academic-meta";
import { ACADEMIC_TEXT_FIELDS } from "@/lib/academic/fields";

export function ProjectAcademicPanel({
  projectId,
  writable,
  initial,
}: {
  projectId: string;
  writable: boolean;
  initial: ProjectAcademicMeta;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState(initial);
  const [pending, start] = useTransition();
  const [info, setInfo] = useState("");

  function setField(key: keyof ProjectAcademicMeta, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  function save() {
    start(async () => {
      const res = await updateProjectAcademicMeta(projectId, meta);
      setInfo(res.error ?? "Salvo.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Metodologia</h3>
        {ACADEMIC_TEXT_FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <p className="mb-1 text-xs text-muted">{f.hint}</p>
            <Textarea
              rows={f.rows}
              value={String(meta[f.key as keyof ProjectAcademicMeta] ?? "")}
              disabled={!writable}
              onChange={(e) => setField(f.key as keyof ProjectAcademicMeta, e.target.value)}
            />
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Orientador</Label>
            <Input
              value={meta.advisorName}
              disabled={!writable}
              onChange={(e) => setField("advisorName", e.target.value)}
            />
          </div>
          <div>
            <Label>Coorientador</Label>
            <Input
              value={meta.coAdvisorName}
              disabled={!writable}
              onChange={(e) => setField("coAdvisorName", e.target.value)}
            />
          </div>
          <div>
            <Label>Inicio</Label>
            <Input
              type="date"
              value={meta.startDate?.slice(0, 10) ?? ""}
              disabled={!writable}
              onChange={(e) => setField("startDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
            />
          </div>
          <div>
            <Label>Defesa prevista</Label>
            <Input
              type="date"
              value={meta.expectedDefenseDate?.slice(0, 10) ?? ""}
              disabled={!writable}
              onChange={(e) =>
                setField("expectedDefenseDate", e.target.value ? new Date(e.target.value).toISOString() : "")
              }
            />
          </div>
        </div>
        {writable && (
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar metodologia"}</Button>
            {info && <span className="text-xs text-muted">{info}</span>}
          </div>
        )}
      </Card>

      <CoursesPendingEditor
        courses={meta.courses}
        pendingItems={meta.pending}
        writable={writable}
        onChange={(courses, pendingItems) => setMeta((m) => ({ ...m, courses, pending: pendingItems }))}
        onSave={save}
        pending={pending}
      />
    </div>
  );
}

function CoursesPendingEditor({
  courses,
  pendingItems,
  writable,
  onChange,
  onSave,
  pending,
}: {
  courses: AcademicCourse[];
  pendingItems: AcademicPending[];
  writable: boolean;
  onChange: (courses: AcademicCourse[], pending: AcademicPending[]) => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">Disciplinas</h3>
        {courses.map((c, i) => (
          <div key={i} className="grid grid-cols-4 gap-2">
            <Input
              placeholder="Codigo"
              value={c.code}
              disabled={!writable}
              onChange={(e) => {
                const next = [...courses];
                next[i] = { ...c, code: e.target.value };
                onChange(next, pendingItems);
              }}
            />
            <Input
              className="col-span-2"
              placeholder="Nome"
              value={c.name}
              disabled={!writable}
              onChange={(e) => {
                const next = [...courses];
                next[i] = { ...c, name: e.target.value };
                onChange(next, pendingItems);
              }}
            />
            <Input
              placeholder="Status"
              value={c.status}
              disabled={!writable}
              onChange={(e) => {
                const next = [...courses];
                next[i] = { ...c, status: e.target.value };
                onChange(next, pendingItems);
              }}
            />
          </div>
        ))}
        {writable && (
          <Button
            variant="outline"
            onClick={() => onChange([...courses, { code: "", name: "", status: "planned" }], pendingItems)}
          >
            Adicionar disciplina
          </Button>
        )}
      </Card>
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">Pendencias</h3>
        {pendingItems.map((p, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <Input
              className="col-span-2"
              placeholder="Titulo"
              value={p.title}
              disabled={!writable}
              onChange={(e) => {
                const next = [...pendingItems];
                next[i] = { ...p, title: e.target.value };
                onChange(courses, next);
              }}
            />
            <Input
              placeholder="Status"
              value={p.status}
              disabled={!writable}
              onChange={(e) => {
                const next = [...pendingItems];
                next[i] = { ...p, status: e.target.value };
                onChange(courses, next);
              }}
            />
          </div>
        ))}
        {writable && (
          <>
            <Button
              variant="outline"
              onClick={() =>
                onChange(courses, [...pendingItems, { title: "", kind: "other", status: "open" }])
              }
            >
              Adicionar pendencia
            </Button>
            <Button onClick={onSave} disabled={pending}>Salvar disciplinas/pendencias</Button>
          </>
        )}
      </Card>
    </div>
  );
}
