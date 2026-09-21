"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { requirePermission, requireUser } from "@/lib/rbac";
import { getPluginSettings, ensurePluginRegistry } from "@/plugins/registry";
import {
  assertCanEditRecord,
  canCreateRecord,
  canDeleteRecord,
  canManageRepository,
  canViewRecord,
  canViewRepository,
} from "@/lib/repository/access";
import { nextHandle, uniqueCollectionSlug, slugify } from "@/lib/repository/collections";
import {
  buildStoragePath,
  deleteRecordStorage,
  deleteRepositoryFile,
  DEFAULT_MAX_FILE_BYTES,
  isAcceptedRepositoryFile,
  saveRepositoryFile,
  sanitizeFileName,
  sha256,
} from "@/lib/repository/storage";
import {
  buildCitation,
  isRecordStatus,
  isResourceType,
  isVisibility,
  parseAuthors,
  type RecordAuthor,
} from "@/lib/repository/vocab";
import { getRecordById, searchRepository } from "@/lib/repository/search";
import { indexRepositoryRecord, purgeRepositoryRecord } from "@/lib/repository/indexer";
import { canViewRepository as canView } from "@/lib/repository/access";
import type {
  RepositorySearchQuery,
  RepositorySearchResult,
} from "@/lib/repository/search-types";

export type RecordInput = {
  title: string;
  subtitle?: string | null;
  abstract?: string;
  resourceType?: string;
  authors?: RecordAuthor[];
  publisher?: string | null;
  venue?: string | null;
  year?: number | null;
  publishedAt?: string | null;
  language?: string;
  doi?: string | null;
  isbn?: string | null;
  issn?: string | null;
  externalUrl?: string | null;
  license?: string | null;
  rights?: string | null;
  tags?: string;
  subjects?: string[];
  notes?: string;
  collectionId?: string | null;
  projectId?: string | null;
  visibility?: string;
  status?: string;
};

type ActionResult<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

function normalizeAuthors(authors: RecordAuthor[] | undefined): string {
  if (!authors?.length) return "[]";
  const list = authors
    .map((a) => ({
      name: (a.name ?? "").trim(),
      affiliation: clean(a.affiliation) ?? undefined,
      orcid: clean(a.orcid) ?? undefined,
      role: clean(a.role) ?? undefined,
    }))
    .filter((a) => a.name);
  return JSON.stringify(list);
}

function normalizeTags(tags: string | undefined): string {
  if (!tags) return "";
  return [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))].join(",");
}

function normalizeSubjects(subjects: string[] | undefined): string {
  if (!subjects?.length) return "[]";
  return JSON.stringify([...new Set(subjects.map((s) => slugify(s)).filter(Boolean))]);
}

async function handlePrefix(): Promise<string> {
  await ensurePluginRegistry();
  const raw = getPluginSettings("repository").handlePrefix;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "labflow";
}

export async function maxUploadBytes(): Promise<number> {
  await ensurePluginRegistry();
  const raw = Number(getPluginSettings("repository").maxFileMb);
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw) * 1024 * 1024;
  return DEFAULT_MAX_FILE_BYTES;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export async function createRecord(input: RecordInput): Promise<ActionResult<{ id: string; handle: string }>> {
  try {
    const user = await requireUser();
    if (!(await canCreateRecord(user))) return { ok: false, error: "Sem permissao" };
    if (!input.title?.trim()) return { ok: false, error: "Titulo obrigatorio" };

    const manage = await canManageRepository(user);
    const requestedStatus = isRecordStatus(input.status ?? "") ? input.status! : "draft";
    // Publishing is a curation act: a depositor submits, a curator publishes.
    const status = requestedStatus === "published" && !manage ? "submitted" : requestedStatus;

    const handle = await nextHandle(await handlePrefix());
    const record = await prisma.repositoryRecord.create({
      data: {
        handle,
        title: input.title.trim(),
        subtitle: clean(input.subtitle),
        abstract: (input.abstract ?? "").trim(),
        resourceType: isResourceType(input.resourceType ?? "") ? input.resourceType! : "article",
        authorsJson: normalizeAuthors(input.authors),
        publisher: clean(input.publisher),
        venue: clean(input.venue),
        year: input.year ?? null,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        language: clean(input.language) ?? "pt",
        doi: clean(input.doi),
        isbn: clean(input.isbn),
        issn: clean(input.issn),
        externalUrl: clean(input.externalUrl),
        license: clean(input.license),
        rights: clean(input.rights),
        tags: normalizeTags(input.tags),
        subjectsJson: normalizeSubjects(input.subjects),
        notes: (input.notes ?? "").trim(),
        collectionId: clean(input.collectionId),
        projectId: clean(input.projectId),
        visibility: isVisibility(input.visibility ?? "") ? input.visibility! : "members",
        status,
        submitterId: user.id,
      },
    });

    await prisma.repositoryRecord.update({
      where: { id: record.id },
      data: { citation: buildCitation(record) },
    });

    await emit({
      type: "repository.record_created",
      actorId: user.id,
      projectId: record.projectId,
      targetId: record.id,
      payload: { id: record.id, handle: record.handle, title: record.title, status: record.status },
    });

    revalidatePath("/repository");
    return { ok: true, id: record.id, handle: record.handle };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao criar deposito" };
  }
}

export async function updateRecord(id: string, input: RecordInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const existing = await prisma.repositoryRecord.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Deposito nao encontrado" };
    await assertCanEditRecord(user, existing);

    const manage = await canManageRepository(user);
    const requestedStatus = isRecordStatus(input.status ?? "") ? input.status! : existing.status;
    const status =
      requestedStatus !== existing.status && requestedStatus === "published" && !manage
        ? "submitted"
        : requestedStatus;

    const updated = await prisma.repositoryRecord.update({
      where: { id },
      data: {
        title: input.title?.trim() || existing.title,
        subtitle: clean(input.subtitle),
        abstract: (input.abstract ?? "").trim(),
        resourceType: isResourceType(input.resourceType ?? "")
          ? input.resourceType!
          : existing.resourceType,
        authorsJson: normalizeAuthors(input.authors),
        publisher: clean(input.publisher),
        venue: clean(input.venue),
        year: input.year ?? null,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        language: clean(input.language) ?? existing.language,
        doi: clean(input.doi),
        isbn: clean(input.isbn),
        issn: clean(input.issn),
        externalUrl: clean(input.externalUrl),
        license: clean(input.license),
        rights: clean(input.rights),
        tags: normalizeTags(input.tags),
        subjectsJson: normalizeSubjects(input.subjects),
        notes: (input.notes ?? "").trim(),
        collectionId: clean(input.collectionId),
        projectId: clean(input.projectId),
        visibility: isVisibility(input.visibility ?? "") ? input.visibility! : existing.visibility,
        status,
      },
    });

    await prisma.repositoryRecord.update({
      where: { id },
      data: { citation: buildCitation(updated) },
    });

    await emit({
      type:
        status === "published" && existing.status !== "published"
          ? "repository.record_published"
          : "repository.record_updated",
      actorId: user.id,
      projectId: updated.projectId,
      targetId: updated.id,
      payload: { id: updated.id, handle: updated.handle, title: updated.title, status },
    });

    revalidatePath("/repository");
    revalidatePath(`/repository/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao atualizar" };
  }
}

export async function setRecordStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!isRecordStatus(status)) return { ok: false, error: "Status invalido" };
    const existing = await prisma.repositoryRecord.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Deposito nao encontrado" };

    // Only curators publish or withdraw; a depositor may submit their own draft.
    const manage = await canManageRepository(user);
    if (!manage) {
      const own = existing.submitterId === user.id;
      const allowed = own && existing.status === "draft" && status === "submitted";
      if (!allowed) return { ok: false, error: "Sem permissao" };
    }

    await prisma.repositoryRecord.update({ where: { id }, data: { status } });
    await emit({
      type: status === "published" ? "repository.record_published" : "repository.record_updated",
      actorId: user.id,
      projectId: existing.projectId,
      targetId: id,
      payload: { id, handle: existing.handle, title: existing.title, status },
    });
    revalidatePath("/repository");
    revalidatePath(`/repository/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao mudar status" };
  }
}

export async function deleteRecord(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const existing = await prisma.repositoryRecord.findUnique({
      where: { id },
      include: { files: { select: { storagePath: true, storage: true } } },
    });
    if (!existing) return { ok: false, error: "Deposito nao encontrado" };
    if (!(await canDeleteRecord(user, existing))) return { ok: false, error: "Sem permissao" };

    const localPaths = existing.files.filter((f) => f.storage === "local").map((f) => f.storagePath);

    // Drop the DB rows first: an orphaned file on disk is recoverable, a row
    // pointing at a deleted file is a broken download for every visitor.
    await prisma.repositoryRecord.delete({ where: { id } });

    // Purge the embeddings here, awaited, rather than leaving it to the
    // `repository.record_deleted` subscriber alone: that runs in the background
    // and its failure would leave vectors of a deleted deposit in the index.
    // The subscriber stays as a backstop for other deletion paths.
    try {
      await purgeRepositoryRecord(id);
    } catch (err) {
      console.error("[repository] falha ao remover deposito do indice", err);
    }

    try {
      await deleteRecordStorage(localPaths);
    } catch (err) {
      console.error("[repository] falha ao remover arquivos do disco", err);
    }

    await emit({
      type: "repository.record_deleted",
      actorId: user.id,
      projectId: existing.projectId,
      targetId: id,
      payload: { id, handle: existing.handle, title: existing.title },
    });

    revalidatePath("/repository");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao excluir" };
  }
}

/** Invenio-style new version: copies the metadata, leaves files to be uploaded. */
export async function createRecordVersion(id: string): Promise<ActionResult<{ id: string; handle: string }>> {
  try {
    const user = await requireUser();
    const source = await prisma.repositoryRecord.findUnique({ where: { id } });
    if (!source) return { ok: false, error: "Deposito nao encontrado" };
    if (!(await canCreateRecord(user))) return { ok: false, error: "Sem permissao" };

    const handle = await nextHandle(await handlePrefix());
    const created = await prisma.repositoryRecord.create({
      data: {
        handle,
        title: source.title,
        subtitle: source.subtitle,
        abstract: source.abstract,
        resourceType: source.resourceType,
        authorsJson: source.authorsJson,
        publisher: source.publisher,
        venue: source.venue,
        year: source.year,
        language: source.language,
        doi: source.doi,
        license: source.license,
        rights: source.rights,
        tags: source.tags,
        subjectsJson: source.subjectsJson,
        notes: source.notes,
        collectionId: source.collectionId,
        projectId: source.projectId,
        visibility: source.visibility,
        status: "draft",
        version: source.version + 1,
        supersedesId: source.id,
        submitterId: user.id,
      },
    });

    await emit({
      type: "repository.record_created",
      actorId: user.id,
      projectId: created.projectId,
      targetId: created.id,
      payload: { id: created.id, handle: created.handle, title: created.title, version: created.version },
    });

    revalidatePath("/repository");
    return { ok: true, id: created.id, handle: created.handle };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao criar versao" };
  }
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * Store one uploaded file, extract its text and refresh the record's fullText.
 * Called from the multipart route handler, not directly from the browser.
 */
export async function attachRecordFile(opts: {
  recordId: string;
  fileName: string;
  bytes: Uint8Array;
  bundle?: string;
}): Promise<ActionResult<{ fileId: string }>> {
  const user = await requireUser();
  const record = await prisma.repositoryRecord.findUnique({ where: { id: opts.recordId } });
  if (!record) return { ok: false, error: "Deposito nao encontrado" };
  await assertCanEditRecord(user, record);

  const name = sanitizeFileName(opts.fileName);
  if (!isAcceptedRepositoryFile(name)) {
    return { ok: false, error: "Formato de arquivo nao aceito" };
  }
  const limit = await maxUploadBytes();
  if (opts.bytes.byteLength > limit) {
    return { ok: false, error: `Arquivo maior que o limite (${Math.round(limit / 1024 / 1024)} MB)` };
  }

  const checksum = sha256(opts.bytes);
  const duplicate = await prisma.repositoryFile.findFirst({
    where: { recordId: opts.recordId, checksum },
    select: { id: true, fileName: true },
  });
  if (duplicate) {
    return { ok: false, error: `Arquivo identico ja anexado (${duplicate.fileName})` };
  }

  const { extractLibraryFile } = await import("@/lib/knowledge/extract");
  let extractedText = "";
  let mimeType = "application/octet-stream";
  try {
    const extracted = await extractLibraryFile(name, opts.bytes);
    extractedText = extracted.text;
    mimeType = extracted.mimeType;
  } catch (err) {
    // A PDF we cannot parse is still a valid deposit; it just is not searchable.
    console.error("[repository] extracao de texto falhou", err);
  }

  const count = await prisma.repositoryFile.count({ where: { recordId: opts.recordId } });
  const fileId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const storagePath = buildStoragePath({
    recordId: opts.recordId,
    fileId,
    fileName: name,
    year: record.createdAt.getUTCFullYear(),
  });
  await saveRepositoryFile({ storagePath, bytes: opts.bytes });

  const created = await prisma.repositoryFile.create({
    data: {
      id: fileId,
      recordId: opts.recordId,
      fileName: name,
      mimeType,
      byteSize: opts.bytes.byteLength,
      checksum,
      storage: "local",
      storagePath,
      bundle: opts.bundle === "supplement" || opts.bundle === "license" || opts.bundle === "thumbnail"
        ? opts.bundle
        : count === 0
          ? "primary"
          : "supplement",
      extractedText,
      order: count,
    },
  });

  await refreshRecordFullText(opts.recordId);

  await emit({
    type: "repository.record_updated",
    actorId: user.id,
    projectId: record.projectId,
    targetId: record.id,
    payload: { id: record.id, handle: record.handle, title: record.title, file: created.fileName },
  });

  revalidatePath(`/repository/${opts.recordId}`);
  return { ok: true, fileId: created.id };
}

export async function removeRecordFile(fileId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = await prisma.repositoryFile.findUnique({
      where: { id: fileId },
      include: { record: true },
    });
    if (!file) return { ok: false, error: "Arquivo nao encontrado" };
    await assertCanEditRecord(user, file.record);

    await prisma.repositoryFile.delete({ where: { id: fileId } });
    if (file.storage === "local") {
      try {
        await deleteRepositoryFile(file.storagePath);
      } catch (err) {
        console.error("[repository] falha ao remover arquivo do disco", err);
      }
    }
    await refreshRecordFullText(file.recordId);
    revalidatePath(`/repository/${file.recordId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao remover arquivo" };
  }
}

/** Concatenate file text into the record, then re-ingest it for RAG. */
export async function refreshRecordFullText(recordId: string): Promise<void> {
  const files = await prisma.repositoryFile.findMany({
    where: { recordId },
    select: { extractedText: true },
    orderBy: { order: "asc" },
  });
  const fullText = files
    .map((f) => f.extractedText.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 400_000);

  await prisma.repositoryRecord.update({ where: { id: recordId }, data: { fullText } });

  // Re-index immediately so a fresh upload is searchable on the next request.
  // The `repository.record_*` subscribers also index, which covers metadata-only
  // edits; `ingest()` skips unchanged content via `contentHash`, so the overlap
  // costs nothing.
  try {
    await indexRepositoryRecord(recordId);
  } catch (err) {
    console.error("[repository] falha ao indexar deposito", err);
  }
}

export async function registerDownload(fileId: string): Promise<void> {
  const file = await prisma.repositoryFile.findUnique({
    where: { id: fileId },
    select: { recordId: true },
  });
  if (!file) return;
  await prisma.repositoryRecord.update({
    where: { id: file.recordId },
    data: { downloadCount: { increment: 1 } },
  });
}

export async function registerView(recordId: string): Promise<void> {
  await prisma.repositoryRecord
    .update({ where: { id: recordId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function createCollection(input: {
  name: string;
  description?: string;
  parentId?: string | null;
  color?: string;
  icon?: string | null;
  visibility?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("repository:view");
    if (!(await canManageRepository(user))) return { ok: false, error: "Sem permissao" };
    if (!input.name?.trim()) return { ok: false, error: "Nome obrigatorio" };

    const last = await prisma.repositoryCollection.findFirst({
      where: { parentId: clean(input.parentId) },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const created = await prisma.repositoryCollection.create({
      data: {
        name: input.name.trim(),
        slug: await uniqueCollectionSlug(input.name),
        description: (input.description ?? "").trim(),
        parentId: clean(input.parentId),
        color: clean(input.color) ?? "#6366f1",
        icon: clean(input.icon),
        visibility: isVisibility(input.visibility ?? "") ? input.visibility! : "members",
        order: (last?.order ?? 0) + 1,
      },
    });
    revalidatePath("/repository");
    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao criar colecao" };
  }
}

export async function updateCollection(
  id: string,
  input: { name?: string; description?: string; color?: string; icon?: string | null; visibility?: string; parentId?: string | null },
): Promise<ActionResult> {
  try {
    const user = await requirePermission("repository:view");
    if (!(await canManageRepository(user))) return { ok: false, error: "Sem permissao" };

    // Reparenting under itself or a descendant would create a cycle.
    if (input.parentId) {
      const { collectionSubtreeIds } = await import("@/lib/repository/search");
      const subtree = await collectionSubtreeIds(id);
      if (subtree.includes(input.parentId)) {
        return { ok: false, error: "Nao e possivel mover uma colecao para dentro dela mesma" };
      }
    }

    await prisma.repositoryCollection.update({
      where: { id },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: clean(input.icon) } : {}),
        ...(input.visibility && isVisibility(input.visibility) ? { visibility: input.visibility } : {}),
        ...(input.parentId !== undefined ? { parentId: clean(input.parentId) } : {}),
      },
    });
    revalidatePath("/repository");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao atualizar colecao" };
  }
}

export async function deleteCollection(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("repository:view");
    if (!(await canManageRepository(user))) return { ok: false, error: "Sem permissao" };

    const [records, children] = await Promise.all([
      prisma.repositoryRecord.count({ where: { collectionId: id } }),
      prisma.repositoryCollection.count({ where: { parentId: id } }),
    ]);
    if (records > 0) {
      return { ok: false, error: `A colecao tem ${records} deposito(s). Mova-os antes de excluir.` };
    }
    if (children > 0) {
      return { ok: false, error: `A colecao tem ${children} subcolecao(oes). Exclua-as antes.` };
    }

    await prisma.repositoryCollection.delete({ where: { id } });
    revalidatePath("/repository");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao excluir colecao" };
  }
}

// ---------------------------------------------------------------------------
// Links to LabFlow entities
// ---------------------------------------------------------------------------

const LINK_TARGETS = ["project", "task", "deliverable", "requirement", "article", "record", "user"];

export async function linkRecord(input: {
  recordId: string;
  targetType: string;
  targetId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const record = await prisma.repositoryRecord.findUnique({ where: { id: input.recordId } });
    if (!record) return { ok: false, error: "Deposito nao encontrado" };
    await assertCanEditRecord(user, record);
    if (!LINK_TARGETS.includes(input.targetType)) return { ok: false, error: "Tipo de vinculo invalido" };

    await prisma.repositoryLink.upsert({
      where: {
        recordId_targetType_targetId: {
          recordId: input.recordId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
      create: { ...input, createdBy: user.id },
      update: {},
    });
    revalidatePath(`/repository/${input.recordId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao vincular" };
  }
}

export async function unlinkRecord(linkId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const link = await prisma.repositoryLink.findUnique({
      where: { id: linkId },
      include: { record: true },
    });
    if (!link) return { ok: false, error: "Vinculo nao encontrado" };
    await assertCanEditRecord(user, link.record);
    await prisma.repositoryLink.delete({ where: { id: linkId } });
    revalidatePath(`/repository/${link.recordId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao remover vinculo" };
  }
}


// ---------------------------------------------------------------------------
// Read actions used by the browse client
// ---------------------------------------------------------------------------

/** Faceted search from the client. Permissions are applied inside the query. */
export async function searchRecordsAction(
  query: RepositorySearchQuery,
): Promise<{ ok: true; data: RepositorySearchResult } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    if (!(await canView(user))) return { ok: false, error: "Sem permissao" };
    return { ok: true, data: await searchRepository(user, query) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha na busca" };
  }
}

/** Ask the AI about the current result set (or the whole repository). */
export async function askRepositoryAction(input: {
  question: string;
  recordIds?: string[];
  scopeLabel?: string;
}): Promise<
  | { ok: true; answer: string; sources: { id: string; title: string; href?: string; path?: string | null }[]; degraded?: boolean }
  | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    if (!(await canView(user))) return { ok: false, error: "Sem permissao" };
    await requirePermission("assistant:use");
    if (!input.question?.trim()) return { ok: false, error: "Escreva uma pergunta" };

    await ensurePluginRegistry();
    if (getPluginSettings("repository").askAiEnabled === false) {
      return { ok: false, error: "Perguntas por IA estao desativadas nas configuracoes do repositorio" };
    }

    const { askRepository } = await import("@/lib/ai/agent");
    const answer = await askRepository(input.question, {
      user,
      recordIds: input.recordIds,
      scopeLabel: input.scopeLabel,
    });
    return {
      ok: true,
      answer: answer.answer,
      degraded: answer.degraded,
      sources: answer.sources.map((s) => ({ id: s.id, title: s.title, href: s.href, path: s.path })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao consultar a IA" };
  }
}

/** Ask the AI about a single deposit. */
export async function askRecordAction(input: {
  recordId: string;
  question: string;
}): Promise<{ ok: true; answer: string; degraded?: boolean } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    if (!(await canView(user))) return { ok: false, error: "Sem permissao" };
    await requirePermission("assistant:use");
    if (!input.question?.trim()) return { ok: false, error: "Escreva uma pergunta" };

    const record = await prisma.repositoryRecord.findUnique({ where: { id: input.recordId } });
    if (!record) return { ok: false, error: "Deposito nao encontrado" };
    if (!(await canViewRecord(user, record))) return { ok: false, error: "Deposito nao encontrado" };

    const { askAboutRecord } = await import("@/lib/ai/agent");
    const answer = await askAboutRecord(record, input.question);
    return { ok: true, answer: answer.answer, degraded: answer.degraded };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao consultar a IA" };
  }
}

export async function reindexRepositoryAction(): Promise<
  { ok: true; indexed: number; skipped: number } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    if (!(await canManageRepository(user))) return { ok: false, error: "Sem permissao" };
    const { reindexRepository } = await import("@/lib/repository/indexer");
    const result = await reindexRepository();
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao reindexar" };
  }
}

/** Guarded read used by the detail page and the API. */
export async function loadRecord(id: string) {
  const user = await requireUser();
  if (!(await canViewRepository(user))) throw new Error("Sem permissao");
  const record = await getRecordById(id);
  if (!record) throw new Error("Deposito nao encontrado");
  if (!(await canViewRecord(user, record))) throw new Error("Deposito nao encontrado");
  return record;
}

export { parseAuthors };
