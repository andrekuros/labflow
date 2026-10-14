"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, PageHeader, Select } from "@/components/ui";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
  Loader2,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatBytes } from "@/lib/repository/format";
import type { RepositoryRecordRow } from "@/lib/repository/search-types";
import {
  FILE_BUNDLE_LABELS,
  LANGUAGE_LABELS,
  LICENSE_LABELS,
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  isRecordStatus,
  type FileBundle,
} from "@/lib/repository/vocab";
import {
  askRecordAction,
  createRecordVersion,
  deleteRecord,
  removeRecordFile,
  setRecordStatus,
  unlinkRecord,
} from "@/plugins/repository/actions";
import { RecordFormDialog, type RecordFormOptions, type RecordFormValues } from "@/components/repository/record-form";

type DetailRecord = RepositoryRecordRow & {
  notes: string;
  rights: string | null;
  isbn: string | null;
  issn: string | null;
  externalUrl: string | null;
  citation: string | null;
  publishedAt: string | null;
  hasFullText: boolean;
  fullTextChars: number;
};

type FileRow = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  bundle: string;
  checksum: string;
  hasText: boolean;
};

export function RecordDetailClient({
  record,
  files,
  links,
  versions,
  supersedes,
  breadcrumb,
  permissions,
  formOptions,
}: {
  record: DetailRecord;
  files: FileRow[];
  links: { id: string; targetType: string; targetId: string; label: string }[];
  versions: { id: string; handle: string; version: number; title: string }[];
  supersedes: { id: string; handle: string; version: number; title: string } | null;
  breadcrumb: { id: string; name: string; slug: string }[];
  permissions: { canEdit: boolean; canDelete: boolean; canManage: boolean; canAskAi: boolean; canCreate: boolean };
  formOptions: RecordFormOptions;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  const statusColor = isRecordStatus(record.status) ? RECORD_STATUS_COLORS[record.status] : "#64748b";
  const statusLabel = isRecordStatus(record.status) ? RECORD_STATUS_LABELS[record.status] : record.status;

  async function copyCitation() {
    if (!record.citation) return;
    await navigator.clipboard.writeText(record.citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function changeStatus(status: string) {
    setError("");
    start(async () => {
      const r = await setRecordStatus(record.id, status);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function removeFile(fileId: string) {
    setError("");
    start(async () => {
      const r = await removeRecordFile(fileId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function removeLink(linkId: string) {
    setError("");
    start(async () => {
      const r = await unlinkRecord(linkId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function newVersion() {
    setError("");
    start(async () => {
      const r = await createRecordVersion(record.id);
      if (!r.ok) setError(r.error);
      else router.push(`/repository/${r.id}`);
    });
  }

  function destroy() {
    if (!window.confirm(`Excluir "${record.title}" e todos os seus arquivos? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    setError("");
    start(async () => {
      const r = await deleteRecord(record.id);
      if (!r.ok) setError(r.error);
      else router.push("/repository");
    });
  }

  async function uploadMore(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setUploading(true);
    const form = new FormData();
    for (const f of list) form.append("file", f);
    try {
      const res = await fetch(`/api/v1/repository/records/${record.id}/files`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as
        | { ok: true; data: { failed: { fileName: string; error: string }[] } }
        | { ok: false; error: string };
      if (!json.ok) setError(json.error);
      else if (json.data.failed?.length) {
        setError(json.data.failed.map((f) => `${f.fileName}: ${f.error}`).join("; "));
      } else {
        setMessage("Arquivo(s) anexado(s).");
      }
      router.refresh();
    } catch {
      setError("Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const editValues: RecordFormValues = {
    id: record.id,
    title: record.title,
    subtitle: record.subtitle ?? "",
    abstract: record.abstract,
    resourceType: record.resourceType,
    authors: record.authors.length > 0 ? record.authors : [{ name: "" }],
    publisher: record.publisher ?? "",
    venue: record.venue ?? "",
    year: record.year ? String(record.year) : "",
    language: record.language,
    doi: record.doi ?? "",
    isbn: record.isbn ?? "",
    issn: record.issn ?? "",
    externalUrl: record.externalUrl ?? "",
    license: record.license ?? "",
    rights: record.rights ?? "",
    tags: record.tags.join(", "),
    subjects: record.subjects.join(", "),
    notes: record.notes,
    collectionId: record.collection?.id ?? "",
    projectId: record.project?.id ?? "",
    visibility: record.visibility,
    status: record.status,
  };

  return (
    <div>
      <Link
        href="/repository"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-fg"
      >
        <ArrowLeft size={13} /> Repositorio
      </Link>

      {breadcrumb.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <Link href={`/repository?collection=${b.id}`} className="hover:text-fg">{b.name}</Link>
            </span>
          ))}
        </p>
      )}

      <PageHeader
        title={record.title}
        description={record.subtitle ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {permissions.canEdit && (
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface2 hover:text-fg"
              >
                <Pencil size={14} /> Editar
              </button>
            )}
            {permissions.canCreate && (
              <button
                type="button"
                onClick={newVersion}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface2 hover:text-fg disabled:opacity-60"
              >
                <GitBranch size={14} /> Nova versao
              </button>
            )}
            {permissions.canDelete && (
              <button
                type="button"
                onClick={destroy}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                <Trash2 size={14} /> Excluir
              </button>
            )}
          </div>
        }
      />

      {(error || message) && (
        <div
          className={`mb-4 flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
            error ? "border-red-500/30 bg-red-500/5 text-red-400" : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {error ? <AlertTriangle size={13} /> : <Check size={13} />}
            {error || message}
          </span>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
            }}
            className="text-muted hover:text-fg"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <Badge className="bg-surface2 text-muted">{record.resourceTypeLabel}</Badge>
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{ backgroundColor: `${statusColor}1f`, color: statusColor }}
        >
          {statusLabel}
        </span>
        {record.version > 1 && <Badge className="bg-surface2 text-muted">versao {record.version}</Badge>}
        {record.collection && <Badge color={record.collection.color}>{record.collection.name}</Badge>}
        {record.project && (
          <Link href={`/projects/${record.project.id}`}>
            <Badge color={record.project.color}>{record.project.key}</Badge>
          </Link>
        )}
        <span className="font-mono text-[11px] text-muted">{record.handle}</span>
        {permissions.canManage && (
          <Select
            value={record.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="ml-auto h-7 w-auto text-xs"
            disabled={pending}
          >
            <option value="draft">Rascunho</option>
            <option value="submitted">Em revisao</option>
            <option value="published">Publicado</option>
            <option value="withdrawn">Retirado</option>
          </Select>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Users size={12} /> Autoria
            </p>
            {record.authors.length === 0 ? (
              <p className="text-sm text-muted">Sem autoria registrada.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {record.authors.map((a, i) => (
                  <li key={`${a.name}-${i}`}>
                    <span className="font-medium">{a.name}</span>
                    {a.affiliation && <span className="text-muted"> · {a.affiliation}</span>}
                    {a.orcid && (
                      <span className="ml-1 font-mono text-[11px] text-muted">ORCID {a.orcid}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {record.abstract && (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold text-muted">Resumo</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{record.abstract}</p>
            </Card>
          )}

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-muted">Arquivos ({files.length})</p>
              {permissions.canEdit && (
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-muted transition hover:bg-surface2 hover:text-fg">
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Anexar
                  <input
                    type="file"
                    multiple
                    accept={formOptions.acceptedExtensions}
                    onChange={(e) => void uploadMore(e.target.files)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {files.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhum arquivo anexado{permissions.canEdit ? " — use Anexar." : "."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-border px-2.5 py-2 text-sm"
                  >
                    <FileText size={14} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {FILE_BUNDLE_LABELS[f.bundle as FileBundle] ?? f.bundle} · {formatBytes(f.byteSize)}
                    </span>
                    {!f.hasText && (
                      <span
                        className="shrink-0 text-[11px] text-amber-500"
                        title="Sem texto extraido: nao entra na busca por conteudo nem nas respostas da IA"
                      >
                        sem texto
                      </span>
                    )}
                    <a
                      href={`/api/v1/repository/files/${f.id}/download`}
                      className="shrink-0 rounded p-1 text-muted transition hover:bg-surface2 hover:text-brand"
                      title={`Baixar (sha256 ${f.checksum.slice(0, 12)}…)`}
                    >
                      <Download size={14} />
                    </a>
                    {permissions.canEdit && (
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        disabled={pending}
                        className="shrink-0 rounded p-1 text-muted transition hover:bg-surface2 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {files.length > 0 && !record.hasFullText && (
              <p className="mt-2 flex items-start gap-1 text-[11px] text-amber-500">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                Nenhum texto foi extraido dos arquivos. A busca por conteudo e as respostas da IA nao
                cobrem este deposito.
              </p>
            )}
          </Card>

          {permissions.canAskAi && (
            <RecordAskPanel recordId={record.id} hasText={record.hasFullText} />
          )}

          {links.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Link2 size={12} /> Vinculos ({links.length})
              </p>
              <ul className="space-y-1 text-sm">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <Badge className="bg-surface2 text-muted">{l.targetType}</Badge>
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    {permissions.canEdit && (
                      <button
                        type="button"
                        onClick={() => removeLink(l.id)}
                        disabled={pending}
                        className="rounded p-1 text-muted hover:text-red-400 disabled:opacity-40"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-2 p-4 text-sm">
            <p className="text-xs font-semibold text-muted">Metadados</p>
            <Field label="Handle" value={record.handle} mono />
            {record.year && <Field label="Ano" value={String(record.year)} />}
            {record.publishedAt && <Field label="Publicado em" value={formatDate(record.publishedAt)} />}
            {record.venue && <Field label="Veiculo" value={record.venue} />}
            {record.publisher && <Field label="Editora" value={record.publisher} />}
            {record.doi && <Field label="DOI" value={record.doi} mono />}
            {record.isbn && <Field label="ISBN" value={record.isbn} mono />}
            {record.issn && <Field label="ISSN" value={record.issn} mono />}
            <Field label="Idioma" value={LANGUAGE_LABELS[record.language] ?? record.language} />
            {record.license && (
              <Field label="Licenca" value={LICENSE_LABELS[record.license] ?? record.license} />
            )}
            {record.rights && <Field label="Direitos" value={record.rights} />}
            {record.externalUrl && (
              <div className="flex items-start gap-1 text-xs">
                <span className="w-24 shrink-0 text-muted">URL</span>
                <a
                  href={record.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1 truncate text-brand hover:underline"
                >
                  <span className="truncate">{record.externalUrl}</span>
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              </div>
            )}
            <Field
              label="Depositado por"
              value={record.submitter?.name ?? "—"}
            />
            <Field label="Criado" value={formatDate(record.createdAt)} />
            <Field label="Atualizado" value={formatDate(record.updatedAt)} />
            <Field
              label="Estatisticas"
              value={`${record.viewCount} visualizacao(oes) · ${record.downloadCount} download(s)`}
            />
          </Card>

          {(record.subjects.length > 0 || record.tags.length > 0) && (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold text-muted">Assuntos e tags</p>
              <div className="flex flex-wrap gap-1">
                {record.subjects.map((s) => (
                  <Link key={s} href={`/repository?subject=${encodeURIComponent(s)}`}>
                    <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand hover:bg-brand/20">
                      {s}
                    </span>
                  </Link>
                ))}
                {record.tags.map((t) => (
                  <Link key={t} href={`/repository?tag=${encodeURIComponent(t)}`}>
                    <span className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-muted hover:text-fg">
                      {t}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {record.citation && (
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted">Como citar</p>
                <button
                  type="button"
                  onClick={copyCitation}
                  className="flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "copiado" : "copiar"}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-muted">{record.citation}</p>
            </Card>
          )}

          {(versions.length > 0 || supersedes) && (
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <GitBranch size={12} /> Versoes
              </p>
              <ul className="space-y-1 text-xs">
                {supersedes && (
                  <li>
                    <Link href={`/repository/${supersedes.id}`} className="hover:text-brand">
                      v{supersedes.version} (anterior) — {supersedes.handle}
                    </Link>
                  </li>
                )}
                <li className="font-medium">v{record.version} (esta)</li>
                {versions.map((v) => (
                  <li key={v.id}>
                    <Link href={`/repository/${v.id}`} className="hover:text-brand">
                      v{v.version} (posterior) — {v.handle}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {record.notes && permissions.canEdit && (
            <Card className="p-4">
              <p className="mb-1 text-xs font-semibold text-muted">Notas internas</p>
              <p className="whitespace-pre-wrap text-xs text-muted">{record.notes}</p>
            </Card>
          )}
        </aside>
      </div>

      {showEdit && (
        <RecordFormDialog
          options={formOptions}
          initial={editValues}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-1 text-xs">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <span className={`min-w-0 flex-1 break-words ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}

function RecordAskPanel({ recordId, hasText }: { recordId: string; hasText: boolean }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<{ q: string; a: string; degraded?: boolean }[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return;
    setError("");
    start(async () => {
      const r = await askRecordAction({ recordId, question: q });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTurns((prev) => [...prev, { q, a: r.answer, degraded: r.degraded }]);
      setQuestion("");
    });
  }

  return (
    <Card className="p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Sparkles size={13} className="text-brand" /> Perguntar sobre este documento
      </p>
      {!hasText ? (
        <p className="text-sm text-muted">
          Este deposito nao tem texto extraido, portanto a IA nao tem o que ler. Anexe um PDF com
          texto (nao digitalizado) ou um arquivo .md/.docx.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            A resposta usa somente o texto deste deposito, nao o resto do acervo.
          </p>
          {turns.length > 0 && (
            <div className="mb-3 space-y-2">
              {turns.map((t, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface2/40 p-2.5">
                  <p className="text-sm font-medium">{t.q}</p>
                  {t.degraded && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                      <AlertTriangle size={11} /> provedor de IA indisponivel
                    </p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-sm">{t.a}</p>
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="mb-2 flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: qual foi a metodologia usada?"
              className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Perguntar
            </button>
          </form>
        </>
      )}
    </Card>
  );
}
