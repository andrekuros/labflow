"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, ChevronDown, ChevronUp, BookOpen, Loader2, FileText, Copy, Check } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label, Badge } from "@/components/ui";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { ACADEMIC_PROGRAM_TYPE_LABELS, academicProgramTypeLabel } from "@/lib/academic-program-meta";
import { ACADEMIC_TEXT_FIELDS, METHODOLOGY_INTRO } from "@/lib/academic/fields";
import type { AcademicFinalReport } from "@/lib/academic/report";
import type { AcademicFieldReview, AcademicReviewFieldKey, AcademicReviews } from "@/lib/academic/reviews";
import {
  saveAcademicProfile,
  reviewAcademicField,
  reviewAllAcademicFields,
  generateAcademicFinalReport,
  type AcademicFormData,
  type CourseRow,
  type PendingRow,
} from "@/plugins/academic/actions";

export function AcademicProfileForm({
  userId,
  userName,
  initial,
  initialReviews,
  initialReport,
  writable,
  canEditProgram = false,
}: {
  userId: string;
  userName: string;
  initial: AcademicFormData;
  initialReviews: AcademicReviews;
  initialReport: AcademicFinalReport | null;
  writable: boolean;
  canEditProgram?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<AcademicFormData>(initial);
  const [reviews, setReviews] = useState<AcademicReviews>(initialReviews);
  const [report, setReport] = useState<AcademicFinalReport | null>(initialReport);
  const [reportOpen, setReportOpen] = useState(Boolean(initialReport));
  const [copied, setCopied] = useState(false);
  const [reviewingField, setReviewingField] = useState<AcademicReviewFieldKey | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();
  const [reviewAllPending, startReviewAll] = useTransition();
  const [reportPending, startReport] = useTransition();

  const setField = <K extends keyof AcademicFormData>(key: K, value: AcademicFormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const addCourse = () => setField("courses", [...data.courses, { code: "", name: "", status: "pendente" }]);
  const addPending = () => setField("pending", [...data.pending, { title: "", kind: "disciplina", status: "pendente" }]);

  const runFieldReview = (field: AcademicReviewFieldKey) => {
    setReviewingField(field);
    start(async () => {
      setError("");
      const result = await reviewAcademicField(userId, field, data);
      setReviewingField(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.review) {
        setReviews((r) => ({ ...r, [field]: result.review }));
      }
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{userName}</h2>
          <p className="text-xs text-muted">Metodologia cientifica e acompanhamento do programa.</p>
        </div>
        <Badge className="bg-surface2 text-muted">{academicProgramTypeLabel(data.program)}</Badge>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface2/50">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
          onClick={() => setGuideOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <BookOpen size={16} className="text-brand" />
            Como preencher — Metodologia Cientifica
          </span>
          {guideOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {guideOpen && (
          <div className="space-y-3 border-t border-border px-3 pb-3 pt-2 text-xs text-muted">
            <p>{METHODOLOGY_INTRO}</p>
            <ul className="list-disc space-y-2 pl-4">
              {ACADEMIC_TEXT_FIELDS.map((f) => (
                <li key={f.key}>
                  <span className="font-medium text-fg">{f.label}:</span> {f.hint}
                </li>
              ))}
            </ul>
            <p className="text-[11px]">
              O guia completo esta na base de conhecimento: &quot;Metodologia Cientifica — Guia para Pesquisa Academica&quot;.
              Use &quot;Analisar com IA&quot; em cada campo e depois &quot;Gerar relatorio final&quot; para uma sintese consolidada.
            </p>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={reviewAllPending || reviewingField !== null || reportPending}
          onClick={() =>
            startReviewAll(async () => {
              setError("");
              setInfo("");
              const result = await reviewAllAcademicFields(userId, data);
              if (result.error) {
                setError(result.error);
                return;
              }
              if (result.reviews) setReviews(result.reviews);
              setInfo("Analise de todos os campos concluida.");
            })
          }
        >
          {reviewAllPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Analisar todos os campos
        </Button>
        <Button
          size="sm"
          disabled={reportPending || reviewAllPending || reviewingField !== null}
          onClick={() =>
            startReport(async () => {
              setError("");
              setInfo("");
              const result = await generateAcademicFinalReport(userId, data);
              if (result.error) {
                setError(result.error);
                return;
              }
              if (result.report) {
                setReport(result.report);
                setReportOpen(true);
                setInfo("Relatorio final gerado.");
              }
            })
          }
        >
          {reportPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Gerar relatorio final
        </Button>
      </div>

      {report && (
        <div className="mb-4 rounded-lg border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium"
              onClick={() => setReportOpen((o) => !o)}
            >
              <FileText size={16} className="text-brand" />
              Relatorio final da proposta
              <Badge className="bg-surface2 text-muted text-[10px]">
                {report.reviewer === "offline" ? "offline" : "IA"}
              </Badge>
              {reportOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted">
                {new Date(report.generatedAt).toLocaleString("pt-BR")}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(report.markdown);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                Copiar
              </Button>
            </div>
          </div>
          {reportOpen && (
            <div className="max-h-[32rem] overflow-y-auto border-t border-border p-4 text-sm">
              <MarkdownView content={report.markdown} />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label>Programa</Label>
          <Select
            value={data.program}
            disabled={!writable || !canEditProgram}
            onChange={(e) => setField("program", e.target.value)}
            className="w-full"
          >
            {(Object.keys(ACADEMIC_PROGRAM_TYPE_LABELS) as (keyof typeof ACADEMIC_PROGRAM_TYPE_LABELS)[]).map((key) => (
              <option key={key} value={key}>
                {ACADEMIC_PROGRAM_TYPE_LABELS[key]}
              </option>
            ))}
          </Select>
          {writable && !canEditProgram && (
            <p className="mt-1 text-xs text-muted">
              Definido pelo perfil do usuario (Equipe ou Configuracoes). Alteracoes aqui nao mudam o programa.
            </p>
          )}
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

      <div className="mt-4 space-y-4">
        {ACADEMIC_TEXT_FIELDS.map((field) => (
          <MethodologyField
            key={field.key}
            label={field.label}
            hint={field.hint}
            rows={field.rows}
            value={data[field.key]}
            review={reviews[field.key]}
            writable={writable}
            reviewing={reviewingField === field.key}
            onChange={(v) => setField(field.key, v)}
            onReview={() => runFieldReview(field.key)}
          />
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

function MethodologyField({
  label,
  hint,
  rows,
  value,
  review,
  writable,
  reviewing,
  onChange,
  onReview,
}: {
  label: string;
  hint: string;
  rows: number;
  value: string;
  review?: AcademicFieldReview;
  writable: boolean;
  reviewing: boolean;
  onChange: (v: string) => void;
  onReview: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button size="sm" variant="ghost" disabled={reviewing} onClick={onReview} className="h-7 text-xs">
          {reviewing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Analisar com IA
        </Button>
      </div>
      <p className="mb-2 text-[11px] text-muted">{hint}</p>
      <Textarea rows={rows} value={value} disabled={!writable} onChange={(e) => onChange(e.target.value)} />
      {review && (
        <div className="mt-2 rounded-md border border-brand/20 bg-brand/5 p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-brand">
            <Sparkles size={12} />
            Observacao {review.reviewer === "offline" ? "(modo offline)" : "da IA"}
          </p>
          <p className="text-xs leading-relaxed text-fg">{review.observation}</p>
          <p className="mt-1 text-[10px] text-muted">
            {new Date(review.reviewedAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
    </div>
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
