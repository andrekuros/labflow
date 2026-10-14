import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { hasPermission } from "@/lib/rbac";
import {
  canManageRepository,
  canViewRecord,
  canViewRepository,
  recordVisibilityWhere,
} from "@/lib/repository/access";
import { getCollectionTree, flattenCollections, collectionBreadcrumb } from "@/lib/repository/collections";
import { getRecordById, getRecordByHandle, searchRepository, toRecordRow } from "@/lib/repository/search";
import type { RepositorySearchQuery, RepositorySort } from "@/lib/repository/search-types";
import { readRepositoryFile } from "@/lib/repository/storage";
import {
  attachRecordFile,
  createCollection,
  createRecord,
  createRecordVersion,
  deleteCollection,
  deleteRecord,
  linkRecord,
  registerDownload,
  removeRecordFile,
  setRecordStatus,
  unlinkRecord,
  updateCollection,
  updateRecord,
  type RecordInput,
} from "@/plugins/repository/actions";
import {
  LICENSES,
  LANGUAGES,
  RECORD_STATUSES,
  RESOURCE_TYPES,
  VISIBILITIES,
  RESOURCE_TYPE_LABELS,
} from "@/lib/repository/vocab";

const SORTS: RepositorySort[] = ["relevance", "recent", "oldest", "title", "year", "downloads"];

function list(sp: URLSearchParams, key: string): string[] | undefined {
  const values = sp.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  return values.length ? values : undefined;
}

function num(sp: URLSearchParams, key: string): number | undefined {
  const raw = sp.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseSearchQuery(request: Request): RepositorySearchQuery {
  const sp = new URL(request.url).searchParams;
  const sortRaw = sp.get("sort") ?? "";
  return {
    q: sp.get("q") ?? undefined,
    collectionId: sp.get("collection") ?? sp.get("collectionId") ?? undefined,
    resourceType: list(sp, "resourceType") ?? list(sp, "type"),
    status: list(sp, "status"),
    tag: list(sp, "tag") ?? list(sp, "tags"),
    subject: list(sp, "subject") ?? list(sp, "subjects"),
    language: list(sp, "language"),
    license: list(sp, "license"),
    projectId: sp.get("project") ?? sp.get("projectId") ?? undefined,
    submitterId: sp.get("submitter") ?? undefined,
    yearFrom: num(sp, "yearFrom"),
    yearTo: num(sp, "yearTo"),
    hasFiles: sp.get("hasFiles") === "true" ? true : undefined,
    sort: (SORTS as string[]).includes(sortRaw) ? (sortRaw as RepositorySort) : undefined,
    page: num(sp, "page"),
    pageSize: num(sp, "pageSize"),
  };
}

export const handlers: PluginApiHandlers = {
  // -- discovery -----------------------------------------------------------
  /** Everything an external UI needs to render forms without hardcoding. */
  "GET vocab": async ({ user }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    return jsonOk({
      resourceTypes: RESOURCE_TYPES.map((id) => ({ id, label: RESOURCE_TYPE_LABELS[id] })),
      statuses: RECORD_STATUSES,
      visibilities: VISIBILITIES,
      licenses: LICENSES,
      languages: LANGUAGES,
      sorts: SORTS,
    });
  },

  // -- collections ---------------------------------------------------------
  "GET collections": async ({ user }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const tree = await getCollectionTree(user);
    return jsonOk({ tree, flat: flattenCollections(tree).map(({ children, ...c }) => ({ ...c, childCount: children.length })) });
  },

  "GET collections/:id": async ({ user, params }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const row = await prisma.repositoryCollection.findUnique({ where: { id: params.id } });
    if (!row) return jsonError("Colecao nao encontrada", 404);
    if (row.visibility === "admin" && !(await canManageRepository(user))) {
      return jsonError("Colecao nao encontrada", 404);
    }
    return jsonOk({ ...row, breadcrumb: await collectionBreadcrumb(row.id) });
  },

  "POST collections": async ({ user }, body) => {
    if (!(await canManageRepository(user))) return jsonError("Sem permissao", 403);
    const input = body as { name?: string };
    if (!input?.name?.trim()) return jsonError("Campo name obrigatorio");
    return runApiAction(() => createCollection(body as Parameters<typeof createCollection>[0]));
  },

  "PATCH collections/:id": async ({ user, params }, body) => {
    if (!(await canManageRepository(user))) return jsonError("Sem permissao", 403);
    return runApiAction(() => updateCollection(params.id, (body ?? {}) as Parameters<typeof updateCollection>[1]));
  },

  "DELETE collections/:id": async ({ user, params }) => {
    if (!(await canManageRepository(user))) return jsonError("Sem permissao", 403);
    return runApiAction(() => deleteCollection(params.id));
  },

  // -- records -------------------------------------------------------------
  /** Faceted search. Every filter of the browse UI is available here. */
  "GET records": async ({ user, request }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    return runApiAction(() => searchRepository(user, parseSearchQuery(request)));
  },

  "GET records/:id": async ({ user, params }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const record = await getRecordById(params.id);
    if (!record) return jsonError("Deposito nao encontrado", 404);
    if (!(await canViewRecord(user, record))) return jsonError("Deposito nao encontrado", 404);
    return jsonOk({
      ...toRecordRow(record),
      notes: record.notes,
      rights: record.rights,
      isbn: record.isbn,
      issn: record.issn,
      externalUrl: record.externalUrl,
      citation: record.citation,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      files: record.files,
      links: record.links,
      versions: record.versions,
      supersedes: record.supersedes,
      hasFullText: record.fullText.length > 0,
    });
  },

  /** Resolve a citable handle, e.g. GET records/by-handle?handle=labflow/2026/000042 */
  "GET by-handle": async ({ user, request }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const handle = new URL(request.url).searchParams.get("handle");
    if (!handle) return jsonError("Query handle obrigatoria");
    const record = await getRecordByHandle(handle);
    if (!record) return jsonError("Deposito nao encontrado", 404);
    if (!(await canViewRecord(user, record))) return jsonError("Deposito nao encontrado", 404);
    return jsonOk(toRecordRow(record));
  },

  "POST records": async ({ user }, body) => {
    if (!(await hasPermission(user, "repository:create"))) return jsonError("Sem permissao", 403);
    const input = body as RecordInput | undefined;
    if (!input?.title?.trim()) return jsonError("Campo title obrigatorio");
    return runApiAction(() => createRecord(input));
  },

  "PATCH records/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "repository:edit"))) return jsonError("Sem permissao", 403);
    const input = body as RecordInput | undefined;
    if (!input) return jsonError("Corpo JSON obrigatorio");
    return runApiAction(() => updateRecord(params.id, input));
  },

  "DELETE records/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "repository:delete"))) return jsonError("Sem permissao", 403);
    return runApiAction(() => deleteRecord(params.id));
  },

  "POST records/:id/status": async ({ params }, body) => {
    const input = body as { status?: string } | undefined;
    if (!input?.status) return jsonError("Campo status obrigatorio");
    return runApiAction(() => setRecordStatus(params.id, input.status!));
  },

  "POST records/:id/versions": async ({ user, params }) => {
    if (!(await hasPermission(user, "repository:create"))) return jsonError("Sem permissao", 403);
    return runApiAction(() => createRecordVersion(params.id));
  },

  // -- files ---------------------------------------------------------------
  /**
   * Multipart upload: POST records/:id/files with `file` (repeatable) and an
   * optional `bundle` field. The catch-all leaves the body intact for this.
   */
  "POST records/:id/files": async ({ user, params, request }) => {
    if (!(await hasPermission(user, "repository:edit"))) return jsonError("Sem permissao", 403);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError("Envie multipart/form-data com o campo 'file'");
    }

    const entries = form.getAll("file").filter((f): f is File => f instanceof File);
    if (entries.length === 0) return jsonError("Nenhum arquivo recebido no campo 'file'");
    const bundle = String(form.get("bundle") ?? "") || undefined;

    const uploaded: { fileName: string; fileId: string }[] = [];
    const failed: { fileName: string; error: string }[] = [];

    for (const file of entries) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await attachRecordFile({
        recordId: params.id,
        fileName: file.name,
        bytes,
        bundle,
      });
      if (result.ok) uploaded.push({ fileName: file.name, fileId: result.fileId });
      else failed.push({ fileName: file.name, error: result.error });
    }

    if (uploaded.length === 0) {
      return jsonError(failed[0]?.error ?? "Falha no upload", 400);
    }
    return jsonOk({ uploaded, failed });
  },

  "GET files/:id": async ({ user, params }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const file = await prisma.repositoryFile.findUnique({
      where: { id: params.id },
      include: { record: true },
    });
    if (!file) return jsonError("Arquivo nao encontrado", 404);
    if (!(await canViewRecord(user, file.record))) return jsonError("Arquivo nao encontrado", 404);
    const { record, ...rest } = file;
    void record;
    return jsonOk({ ...rest, extractedText: undefined, hasText: file.extractedText.length > 0 });
  },

  /** Streams the stored bytes. Returns the file itself, not a JSON envelope. */
  "GET files/:id/download": async ({ user, params }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const file = await prisma.repositoryFile.findUnique({
      where: { id: params.id },
      include: { record: true },
    });
    if (!file) return jsonError("Arquivo nao encontrado", 404);
    if (!(await canViewRecord(user, file.record))) return jsonError("Arquivo nao encontrado", 404);
    if (file.storage !== "local") return jsonError("Arquivo nao esta no armazenamento local", 501);

    try {
      const bytes = await readRepositoryFile(file.storagePath);
      await registerDownload(file.id);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": file.mimeType || "application/octet-stream",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
          "X-Checksum-Sha256": file.checksum,
          "Cache-Control": "private, max-age=300",
        },
      });
    } catch {
      return jsonError("Arquivo ausente no armazenamento", 502);
    }
  },

  "DELETE files/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "repository:edit"))) return jsonError("Sem permissao", 403);
    return runApiAction(() => removeRecordFile(params.id));
  },

  // -- links ---------------------------------------------------------------
  "POST records/:id/links": async ({ params }, body) => {
    const input = body as { targetType?: string; targetId?: string } | undefined;
    if (!input?.targetType || !input?.targetId) {
      return jsonError("Campos targetType e targetId sao obrigatorios");
    }
    return runApiAction(() =>
      linkRecord({ recordId: params.id, targetType: input.targetType!, targetId: input.targetId! }),
    );
  },

  "DELETE links/:id": async ({ params }) => runApiAction(() => unlinkRecord(params.id)),

  // -- AI over the corpus ---------------------------------------------------
  /**
   * POST ask { question, recordIds?, collectionId?, projectId? }
   * Answers from the deposited documents, with citations. `recordIds` or the
   * filters narrow the corpus to exactly what the caller is looking at.
   */
  "POST ask": async ({ user }, body) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    if (!(await hasPermission(user, "assistant:use"))) return jsonError("Sem permissao", 403);

    const input = body as
      | { question?: string; recordIds?: string[]; collectionId?: string; projectId?: string }
      | undefined;
    if (!input?.question?.trim()) return jsonError("Campo question obrigatorio");

    let recordIds = Array.isArray(input.recordIds) ? input.recordIds.filter((s) => typeof s === "string") : undefined;
    let scopeLabel: string | undefined;

    if (!recordIds && (input.collectionId || input.projectId)) {
      const { collectionSubtreeIds } = await import("@/lib/repository/search");
      const rows = await prisma.repositoryRecord.findMany({
        where: {
          AND: [
            await recordVisibilityWhere(user),
            input.collectionId
              ? { collectionId: { in: await collectionSubtreeIds(input.collectionId) } }
              : {},
            input.projectId ? { projectId: input.projectId } : {},
          ],
        },
        select: { id: true },
      });
      recordIds = rows.map((r) => r.id);
      scopeLabel = input.collectionId ? "colecao selecionada" : "projeto selecionado";
    }

    const { askRepository } = await import("@/lib/ai/agent");
    return runApiAction(() =>
      askRepository(input.question!, { user, recordIds, scopeLabel }),
    );
  },

  /** POST records/:id/ask { question } — answers strictly from that deposit. */
  "POST records/:id/ask": async ({ user, params }, body) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    if (!(await hasPermission(user, "assistant:use"))) return jsonError("Sem permissao", 403);

    const input = body as { question?: string } | undefined;
    if (!input?.question?.trim()) return jsonError("Campo question obrigatorio");

    const record = await prisma.repositoryRecord.findUnique({ where: { id: params.id } });
    if (!record) return jsonError("Deposito nao encontrado", 404);
    if (!(await canViewRecord(user, record))) return jsonError("Deposito nao encontrado", 404);

    const { askAboutRecord } = await import("@/lib/ai/agent");
    return runApiAction(() => askAboutRecord(record, input.question!));
  },

  // -- maintenance ---------------------------------------------------------
  "POST reindex": async ({ user }) => {
    if (!(await canManageRepository(user))) return jsonError("Sem permissao", 403);
    const { reindexRepository } = await import("@/lib/repository/indexer");
    return runApiAction(() => reindexRepository());
  },

  "GET stats": async ({ user }) => {
    if (!(await canViewRepository(user))) return jsonError("Sem permissao", 403);
    const where = await recordVisibilityWhere(user);
    const [total, byStatus, byType, files, collections] = await Promise.all([
      prisma.repositoryRecord.count({ where }),
      prisma.repositoryRecord.groupBy({ by: ["status"], where, _count: true }),
      prisma.repositoryRecord.groupBy({ by: ["resourceType"], where, _count: true }),
      prisma.repositoryFile.aggregate({ _count: true, _sum: { byteSize: true } }),
      prisma.repositoryCollection.count(),
    ]);
    return jsonOk({
      records: total,
      collections,
      files: files._count,
      totalBytes: files._sum.byteSize ?? 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byResourceType: byType.map((t) => ({ resourceType: t.resourceType, count: t._count })),
    });
  },
};
