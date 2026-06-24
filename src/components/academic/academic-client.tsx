"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label, Badge } from "@/components/ui";
import { saveAcademicProfile, type AcademicFormData, type CourseRow, type PendingRow } from "@/plugins/academic/actions";

const EMPTY: AcademicFormData = {
  program: "msc",
  status: "active",
  motivation: "",
  objective: "",
  problemStatement: "",
  hypothesis: "",
  methodology: "",
  academicContribution: "",
  expectedResults: "",
  limitations: "",
  theoreticalFramework: "",
  advisorName: "",
  coAdvisorName: "",
  startDate: "",
  expectedDefenseDate: "",
  courses: [],
  pending: [],
  notes: "",
};

export function AcademicProfileForm({
  userId,
  userName,
  initial,
  writable,
}: {
  userId: string;
  userName: string;
  initial: AcademicFormData;
  writable: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<AcademicFormData>(initial);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();

  const setField = <K extends keyof AcademicFormData>(key: K, value: AcademicFormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const addCourse = () => setField("courses", [...data.courses, { code: "", name: "", status: "pendente" }]);
  const addPending = () => setField("pending", [...data.pending, { title: "", kind: "disciplina", status: "pendente" }]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{userName}</h2>
          <p className="text-xs text-muted">Metodologia cientifica e acompanhamento do programa.</p>
        </div>
        <Badge className="bg-surface2 text-muted">{data.program === "phd" ? "Doutorado" : "Mestrado"}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label>Programa</Label>
          <Select value={data.program} disabled={!writable} onChange={(e) => setField("program", e.target.value)} className="w-full">
            <option value="msc">Mestrado</option>
            <option value="phd">Doutorado</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={data.status} disabled={!writable} onChange={(e) => setField("status", e.target.value)} className="w-full">
            <option value="active">Em andamento</option>
            <option value="completed">Concluido</option>
            <option value="suspended">Suspenso</option>
          </Select>
        </div>
        <div><Label>Orientador</Label><Input value={data.advisorName} disabled={!writable} onChange={(e) => setField("advisorName", e.target.value)} /></div>
        <div><Label>Coorientador</Label><Input value={data.coAdvisorName} disabled={!writable} onChange={(e) => setField("coAdvisorName", e.target.value)} /></div>
        <div><Label>Inicio</Label><Input type="date" value={data.startDate} disabled={!writable} onChange={(e) => setField("startDate", e.target.value)} /></div>
        <div><Label>Previsao de defesa</Label><Input type="date" value={data.expectedDefenseDate} disabled={!writable} onChange={(e) => setField("expectedDefenseDate", e.target.value)} /></div>
      </div>

      <div className="mt-4 space-y-3">
        {(
          [
            ["motivation", "Motivacao", 3],
            ["objective", "Objetivo", 2],
            ["problemStatement", "Problema de pesquisa", 3],
            ["hypothesis", "Hipotese", 2],
            ["methodology", "Metodologia", 4],
            ["theoreticalFramework", "Referencial teorico", 3],
            ["academicContribution", "Contribuicao academica", 3],
            ["expectedResults", "Resultado esperado", 3],
            ["limitations", "Limitacoes", 2],
            ["notes", "Notas gerais", 2],
          ] as const
        ).map(([key, label, rows]) => (
          <div key={key}>
            <Label>{label}</Label>
            <Textarea
              rows={rows}
              value={data[key]}
              disabled={!writable}
              onChange={(e) => setField(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Disciplinas</h3>
          {writable && <Button size="sm" variant="outline" onClick={addCourse}><Plus size={14} /> Adicionar</Button>}
        </div>
        <div className="space-y-2">
          {data.courses.length === 0 && <p className="text-xs text-muted">Nenhuma disciplina registrada.</p>}
          {data.courses.map((c, i) => (
            <CourseRowEditor
              key={i}
              row={c}
              writable={writable}
              onChange={(row) => {
                const next = [...data.courses];
                next[i] = row;
                setField("courses", next);
              }}
              onRemove={() => setField("courses", data.courses.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pendencias</h3>
          {writable && <Button size="sm" variant="outline" onClick={addPending}><Plus size={14} /> Adicionar</Button>}
        </div>
        <div className="space-y-2">
          {data.pending.length === 0 && <p className="text-xs text-muted">Nenhuma pendencia.</p>}
          {data.pending.map((p, i) => (
            <PendingRowEditor
              key={i}
              row={p}
              writable={writable}
              onChange={(row) => {
                const next = [...data.pending];
                next[i] = row;
                setField("pending", next);
              }}
              onRemove={() => setField("pending", data.pending.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      {info && <p className="mt-3 text-xs text-brand">{info}</p>}

      {writable && (
        <div className="mt-4 flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError("");
                setInfo("");
                try {
                  await saveAcademicProfile(userId, data);
                  setInfo("Salvo com sucesso.");
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Erro ao salvar");
                }
              })
            }
          >
            Salvar
          </Button>
        </div>
      )}
    </Card>
  );
}

function CourseRowEditor({
  row,
  writable,
  onChange,
  onRemove,
}: {
  row: CourseRow;
  writable: boolean;
  onChange: (row: CourseRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
      <div className="w-20"><Label>Codigo</Label><Input value={row.code} disabled={!writable} onChange={(e) => onChange({ ...row, code: e.target.value })} /></div>
      <div className="min-w-[160px] flex-1"><Label>Nome</Label><Input value={row.name} disabled={!writable} onChange={(e) => onChange({ ...row, name: e.target.value })} /></div>
      <div className="w-28"><Label>Status</Label>
        <Select value={row.status} disabled={!writable} onChange={(e) => onChange({ ...row, status: e.target.value })} className="w-full">
          <option value="pendente">Pendente</option>
          <option value="cursando">Cursando</option>
          <option value="concluida">Concluida</option>
        </Select>
      </div>
      <div className="w-20"><Label>Nota</Label><Input value={row.grade ?? ""} disabled={!writable} onChange={(e) => onChange({ ...row, grade: e.target.value })} /></div>
      {writable && <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 size={14} /></Button>}
    </div>
  );
}

function PendingRowEditor({
  row,
  writable,
  onChange,
  onRemove,
}: {
  row: PendingRow;
  writable: boolean;
  onChange: (row: PendingRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
      <div className="min-w-[160px] flex-1"><Label>Titulo</Label><Input value={row.title} disabled={!writable} onChange={(e) => onChange({ ...row, title: e.target.value })} /></div>
      <div className="w-32"><Label>Tipo</Label>
        <Select value={row.kind} disabled={!writable} onChange={(e) => onChange({ ...row, kind: e.target.value })} className="w-full">
          <option value="disciplina">Disciplina</option>
          <option value="documento">Documento</option>
          <option value="exame">Exame</option>
          <option value="outro">Outro</option>
        </Select>
      </div>
      <div className="w-28"><Label>Status</Label>
        <Select value={row.status} disabled={!writable} onChange={(e) => onChange({ ...row, status: e.target.value })} className="w-full">
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluido</option>
        </Select>
      </div>
      <div className="w-36"><Label>Prazo</Label><Input type="date" value={row.dueDate ?? ""} disabled={!writable} onChange={(e) => onChange({ ...row, dueDate: e.target.value })} /></div>
      {writable && <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 size={14} /></Button>}
    </div>
  );
}

export function profileToForm(profile: {
  program: string;
  status: string;
  motivation: string;
  objective: string;
  problemStatement: string;
  hypothesis: string;
  methodology: string;
  academicContribution: string;
  expectedResults: string;
  limitations: string;
  theoreticalFramework: string;
  advisorName: string | null;
  coAdvisorName: string | null;
  startDate: Date | null;
  expectedDefenseDate: Date | null;
  coursesJson: string;
  pendingJson: string;
  notes: string;
}): AcademicFormData {
  let courses: CourseRow[] = [];
  let pending: PendingRow[] = [];
  try {
    courses = JSON.parse(profile.coursesJson);
    pending = JSON.parse(profile.pendingJson);
  } catch {
    /* ignore */
  }
  return {
    program: profile.program,
    status: profile.status,
    motivation: profile.motivation,
    objective: profile.objective,
    problemStatement: profile.problemStatement,
    hypothesis: profile.hypothesis,
    methodology: profile.methodology,
    academicContribution: profile.academicContribution,
    expectedResults: profile.expectedResults,
    limitations: profile.limitations,
    theoreticalFramework: profile.theoreticalFramework,
    advisorName: profile.advisorName ?? "",
    coAdvisorName: profile.coAdvisorName ?? "",
    startDate: profile.startDate?.toISOString().slice(0, 10) ?? "",
    expectedDefenseDate: profile.expectedDefenseDate?.toISOString().slice(0, 10) ?? "",
    courses,
    pending,
    notes: profile.notes,
  };
}
