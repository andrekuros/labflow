"use client";

import { useState, useTransition } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui";
import { Loader2, Plus, Trash2, Upload, X, FileText, AlertTriangle } from "lucide-react";
import {
  LANGUAGES,
  LICENSES,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  VISIBILITIES,
  VISIBILITY_LABELS,
  type RecordAuthor,
} from "@/lib/repository/vocab";
import { createRecord, updateRecord } from "@/plugins/repository/actions";
import { formatBytes } from "@/lib/repository/format";

export type RecordFormOptions = {
  collections: { id: string; name: string; depth: number }[];
  projects: { id: string; key: string; name: string }[];
  defaultVisibility: string;
  maxFileMb: number;
  acceptedExtensions: string;
  canManage: boolean;
};

export type RecordFormValues = {
  id?: string;
  title: string;
  subtitle: string;
  abstract: string;
  resourceType: string;
  authors: RecordAuthor[];
  publisher: string;
  venue: string;
  year: string;
  language: string;
  doi: string;
  isbn: string;
  issn: string;
  externalUrl: string;
  license: string;
  rights: string;
  tags: string;
  subjects: string;
  notes: string;
  collectionId: string;
  projectId: string;
  visibility: string;
  status: string;
};

function emptyValues(options: RecordFormOptions): RecordFormValues {
  return {
    title: "",
    subtitle: "",
    abstract: "",
    resourceType: "article",
    authors: [{ name: "" }],
    publisher: "",
    venue: "",
    year: String(new Date().getFullYear()),
    language: "pt",
    doi: "",
    isbn: "",
    issn: "",
    externalUrl: "",
    license: "",
    rights: "",
    tags: "",
    subjects: "",
    notes: "",
    collectionId: "",
    projectId: "",
    visibility: options.defaultVisibility,
    status: "draft",
  };
}

export function RecordFormDialog({
  options,
  initial,
  onClose,
  onSaved,
}: {
  options: RecordFormOptions;
  initial?: RecordFormValues;
  onClose: () => void;
  onSaved: (recordId: string) => void;
}) {
  const [values, setValues] = useState<RecordFormValues>(initial ?? emptyValues(options));
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();
  const isEdit = Boolean(initial?.id);
  const maxBytes = options.maxFileMb * 1024 * 1024;

  function set<K extends keyof RecordFormValues>(key: K, value: RecordFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setAuthor(index: number, patch: Partial<RecordAuthor>) {
    setValues((prev) => ({
      ...prev,
      authors: prev.authors.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const incoming = [...list];
    const tooBig = incoming.filter((f) => f.size > maxBytes);
    if (tooBig.length > 0) {
      setError(
        `Arquivo(s) acima do limite de ${options.maxFileMb} MB: ${tooBig.map((f) => f.name).join(", ")}`,
      );
    }
    setFiles((prev) => [...prev, ...incoming.filter((f) => f.size <= maxBytes)]);
  }

  async function uploadFiles(recordId: string): Promise<string | null> {
    if (files.length === 0) return null;
    const form = new FormData();
    for (const f of files) form.append("file", f);
    setProgress(`Enviando ${files.length} arquivo(s)...`);
    const res = await fetch(`/api/v1/repository/records/${recordId}/files`, {
      method: "POST",
      body: form,
    });
    const json = (await res.json()) as
      | { ok: true; data: { uploaded: unknown[]; failed: { fileName: string; error: string }[] } }
      | { ok: false; error: string };
    if (!json.ok) return json.error;
    if (json.data.failed?.length) {
      return `Alguns arquivos falharam: ${json.data.failed.map((f) => `${f.fileName} (${f.error})`).join("; ")}`;
    }
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("Titulo obrigatorio");
      return;
    }
    setError("");
    start(async () => {
      const payload = {
        title: values.title,
        subtitle: values.subtitle || null,
        abstract: values.abstract,
        resourceType: values.resourceType,
        authors: values.authors.filter((a) => a.name.trim()),
        publisher: values.publisher || null,
        venue: values.venue || null,
        year: values.year ? Number(values.year) : null,
        language: values.language,
        doi: values.doi || null,
        isbn: values.isbn || null,
        issn: values.issn || null,
        externalUrl: values.externalUrl || null,
        license: values.license || null,
        rights: values.rights || null,
        tags: values.tags,
        subjects: values.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        notes: values.notes,
        collectionId: values.collectionId || null,
        projectId: values.projectId || null,
        visibility: values.visibility,
        status: values.status,
      };

      if (isEdit && initial?.id) {
        const r = await updateRecord(initial.id, payload);
        if (!r.ok) {
          setError(r.error);
          setProgress("");
          return;
        }
        const uploadError = await uploadFiles(initial.id);
        setProgress("");
        if (uploadError) {
          setError(uploadError);
          return;
        }
        onSaved(initial.id);
        return;
      }

      const r = await createRecord(payload);
      if (!r.ok) {
        setError(r.error);
        setProgress("");
        return;
      }
      const uploadError = await uploadFiles(r.id);
      setProgress("");
      if (uploadError) {
        // The record exists; only the attachment failed. Say exactly that.
        setError(`Deposito ${r.handle} criado, mas: ${uploadError}`);
        return;
      }
      onSaved(r.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <form
        onSubmit={submit}
        className="w-full max-w-3xl rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            {isEdit ? "Editar deposito" : "Novo deposito no repositorio"}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-surface2">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Identificacao</p>
            <div>
              <Label htmlFor="rec-title">Titulo *</Label>
              <Input
                id="rec-title"
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="rec-subtitle">Subtitulo</Label>
              <Input
                id="rec-subtitle"
                value={values.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rec-abstract">Resumo</Label>
              <Textarea
                id="rec-abstract"
                rows={4}
                value={values.abstract}
                onChange={(e) => set("abstract", e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Autoria</p>
              <button
                type="button"
                onClick={() => setValues((p) => ({ ...p, authors: [...p.authors, { name: "" }] }))}
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <Plus size={12} /> adicionar autor
              </button>
            </div>
            {values.authors.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Nome"
                  value={a.name}
                  onChange={(e) => setAuthor(i, { name: e.target.value })}
                  className="min-w-[180px] flex-1"
                />
                <Input
                  placeholder="Afiliacao"
                  value={a.affiliation ?? ""}
                  onChange={(e) => setAuthor(i, { affiliation: e.target.value })}
                  className="min-w-[140px] flex-1"
                />
                <Input
                  placeholder="ORCID"
                  value={a.orcid ?? ""}
                  onChange={(e) => setAuthor(i, { orcid: e.target.value })}
                  className="w-[150px]"
                />
                {values.authors.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setValues((p) => ({ ...p, authors: p.authors.filter((_, idx) => idx !== i) }))
                    }
                    className="rounded p-1.5 text-muted hover:bg-surface2 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rec-type">Tipo de recurso</Label>
              <Select
                id="rec-type"
                value={values.resourceType}
                onChange={(e) => set("resourceType", e.target.value)}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rec-year">Ano</Label>
              <Input
                id="rec-year"
                type="number"
                min={1900}
                max={2200}
                value={values.year}
                onChange={(e) => set("year", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rec-venue">Veiculo / evento / revista</Label>
              <Input id="rec-venue" value={values.venue} onChange={(e) => set("venue", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rec-publisher">Editora / instituicao</Label>
              <Input
                id="rec-publisher"
                value={values.publisher}
                onChange={(e) => set("publisher", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rec-doi">DOI</Label>
              <Input id="rec-doi" value={values.doi} onChange={(e) => set("doi", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rec-url">URL externa</Label>
              <Input
                id="rec-url"
                value={values.externalUrl}
                onChange={(e) => set("externalUrl", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rec-isbn">ISBN</Label>
              <Input id="rec-isbn" value={values.isbn} onChange={(e) => set("isbn", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rec-issn">ISSN</Label>
              <Input id="rec-issn" value={values.issn} onChange={(e) => set("issn", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rec-lang">Idioma</Label>
              <Select id="rec-lang" value={values.language} onChange={(e) => set("language", e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rec-license">Licenca</Label>
              <Select id="rec-license" value={values.license} onChange={(e) => set("license", e.target.value)}>
                <option value="">Nao especificada</option>
                {LICENSES.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </Select>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rec-collection">Colecao</Label>
              <Select
                id="rec-collection"
                value={values.collectionId}
                onChange={(e) => set("collectionId", e.target.value)}
              >
                <option value="">Sem colecao</option>
                {options.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${"— ".repeat(c.depth)}${c.name}`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rec-project">Projeto vinculado</Label>
              <Select
                id="rec-project"
                value={values.projectId}
                onChange={(e) => set("projectId", e.target.value)}
              >
                <option value="">Sem projeto</option>
                {options.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rec-subjects">Assuntos (separados por virgula)</Label>
              <Input
                id="rec-subjects"
                value={values.subjects}
                onChange={(e) => set("subjects", e.target.value)}
                placeholder="acustica, deteccao, drones"
              />
            </div>
            <div>
              <Label htmlFor="rec-tags">Tags livres (separadas por virgula)</Label>
              <Input
                id="rec-tags"
                value={values.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="calibracao, campo, 2026"
              />
            </div>
            <div>
              <Label htmlFor="rec-visibility">Visibilidade</Label>
              <Select
                id="rec-visibility"
                value={values.visibility}
                onChange={(e) => set("visibility", e.target.value)}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rec-status">Situacao</Label>
              <Select id="rec-status" value={values.status} onChange={(e) => set("status", e.target.value)}>
                <option value="draft">Rascunho</option>
                <option value="submitted">Enviar para revisao</option>
                {options.canManage && <option value="published">Publicado</option>}
                {options.canManage && <option value="withdrawn">Retirado</option>}
              </Select>
              {!options.canManage && (
                <p className="mt-1 text-[11px] text-muted">
                  Publicar depende de quem tem permissao de curadoria.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Arquivos</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted transition hover:border-brand/50 hover:text-fg">
              <Upload size={15} />
              Selecionar arquivos (max {options.maxFileMb} MB cada)
              <input
                type="file"
                multiple
                accept={options.acceptedExtensions}
                onChange={(e) => pickFiles(e.target.files)}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-muted">Aceitos: {options.acceptedExtensions}</p>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs"
                  >
                    <FileText size={12} className="shrink-0 text-muted" />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-muted">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-auto shrink-0 rounded p-0.5 text-muted hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <Label htmlFor="rec-notes">Notas internas</Label>
            <Textarea
              id="rec-notes"
              rows={2}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          {error && (
            <p className="flex items-start gap-1 text-xs text-red-400">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {progress && <p className="text-xs text-muted">{progress}</p>}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Salvar" : "Depositar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
