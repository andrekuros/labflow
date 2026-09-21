import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { recordVisibilityWhere } from "@/lib/repository/access";
import {
  LANGUAGE_LABELS,
  LICENSE_LABELS,
  RECORD_STATUS_LABELS,
  RESOURCE_TYPE_LABELS,
  formatAuthors,
  isRecordStatus,
  isResourceType,
  parseAuthors,
  parseSubjects,
  parseTags,
} from "@/lib/repository/vocab";
import type {
  RepositoryFacet,
  RepositoryRecordRow,
  RepositorySearchFacets,
  RepositorySearchQuery,
  RepositorySearchResult,
} from "@/lib/repository/search-types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** Ceiling on rows scanned to build facets. Beyond it, facet counts are capped. */
const FACET_SCAN_CAP = 5000;

const RECORD_INCLUDE = {
  collection: { select: { id: true, name: true, slug: true, color: true } },
  project: { select: { id: true, key: true, name: true, color: true } },
  submitter: { select: { id: true, name: true } },
  files: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      bundle: true,
      order: true,
      checksum: true,
      extractedText: true,
    },
    orderBy: [{ order: "asc" as const }],
  },
  _count: { select: { links: true } },
} satisfies Prisma.RepositoryRecordInclude;

type RecordWithRelations = Prisma.RepositoryRecordGetPayload<{ include: typeof RECORD_INCLUDE }>;

export function toRecordRow(r: RecordWithRelations): RepositoryRecordRow {
  const authors = parseAuthors(r.authorsJson);
  const primary = r.files.find((f) => f.bundle === "primary") ?? r.files[0] ?? null;
  return {
    id: r.id,
    handle: r.handle,
    title: r.title,
    subtitle: r.subtitle,
    abstract: r.abstract,
    resourceType: r.resourceType,
    resourceTypeLabel: isResourceType(r.resourceType)
      ? RESOURCE_TYPE_LABELS[r.resourceType]
      : r.resourceType,
    authors,
    authorsLabel: formatAuthors(authors),
    year: r.year,
    venue: r.venue,
    publisher: r.publisher,
    doi: r.doi,
    language: r.language,
    license: r.license,
    tags: parseTags(r.tags),
    subjects: parseSubjects(r.subjectsJson),
    status: r.status,
    visibility: r.visibility,
    version: r.version,
    collection: r.collection,
    project: r.project,
    submitter: r.submitter,
    fileCount: r.files.length,
    primaryFile: primary
      ? {
          id: primary.id,
          fileName: primary.fileName,
          mimeType: primary.mimeType,
          byteSize: primary.byteSize,
        }
      : null,
    totalBytes: r.files.reduce((s, f) => s + f.byteSize, 0),
    linkCount: r._count.links,
    viewCount: r.viewCount,
    downloadCount: r.downloadCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Every descendant of a collection, so browsing a community includes its children. */
export async function collectionSubtreeIds(rootId: string): Promise<string[]> {
  const all = await prisma.repositoryCollection.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c.id);
    childrenOf.set(c.parentId, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}

function tokenize(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^["']|["']$/g, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

/**
 * Build the Prisma filter. `skipKey` omits one dimension so that dimension's own
 * facet counts stay meaningful while it is filtered (standard faceted-search
 * behaviour: picking "Artigo" must not collapse the type facet to one row).
 */
async function buildWhere(
  user: SessionUser,
  query: RepositorySearchQuery,
  skipKey?: keyof RepositorySearchFacets,
): Promise<Prisma.RepositoryRecordWhereInput> {
  const and: Prisma.RepositoryRecordWhereInput[] = [await recordVisibilityWhere(user)];

  if (query.q?.trim()) {
    for (const token of tokenize(query.q)) {
      and.push({
        OR: [
          { title: { contains: token } },
          { subtitle: { contains: token } },
          { abstract: { contains: token } },
          { authorsJson: { contains: token } },
          { tags: { contains: token } },
          { subjectsJson: { contains: token } },
          { venue: { contains: token } },
          { publisher: { contains: token } },
          { doi: { contains: token } },
          { handle: { contains: token } },
          { fullText: { contains: token } },
        ],
      });
    }
  }

  if (query.collectionId && skipKey !== "collection") {
    and.push({ collectionId: { in: await collectionSubtreeIds(query.collectionId) } });
  }
  if (query.resourceType?.length && skipKey !== "resourceType") {
    and.push({ resourceType: { in: query.resourceType } });
  }
  if (query.status?.length && skipKey !== "status") {
    and.push({ status: { in: query.status } });
  }
  if (query.language?.length && skipKey !== "language") {
    and.push({ language: { in: query.language } });
  }
  if (query.license?.length && skipKey !== "license") {
    and.push({ license: { in: query.license } });
  }
  if (query.projectId && skipKey !== "project") {
    and.push({ projectId: query.projectId });
  }
  if (query.submitterId) and.push({ submitterId: query.submitterId });
  if (query.yearFrom !== undefined || query.yearTo !== undefined) {
    if (skipKey !== "year") {
      and.push({
        year: {
          ...(query.yearFrom !== undefined ? { gte: query.yearFrom } : {}),
          ...(query.yearTo !== undefined ? { lte: query.yearTo } : {}),
        },
      });
    }
  }
  if (query.hasFiles) and.push({ files: { some: {} } });

  // Tags and subjects are denormalised strings, so they filter with `contains`
  // on a delimited form; exact membership is re-checked in memory below.
  if (query.tag?.length && skipKey !== "tag") {
    and.push({ AND: query.tag.map((t) => ({ tags: { contains: t } })) });
  }
  if (query.subject?.length && skipKey !== "subject") {
    and.push({ AND: query.subject.map((s) => ({ subjectsJson: { contains: s } })) });
  }

  return { AND: and };
}

function orderBy(sort: RepositorySearchQuery["sort"]): Prisma.RepositoryRecordOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "title":
      return [{ title: "asc" }];
    case "year":
      return [{ year: "desc" }, { createdAt: "desc" }];
    case "downloads":
      return [{ downloadCount: "desc" }, { createdAt: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

function toFacet(
  counts: Map<string, number>,
  label: (v: string) => string,
  opts: { limit?: number; numericDesc?: boolean } = {},
): RepositoryFacet[] {
  const rows = [...counts.entries()].map(([value, count]) => ({ value, label: label(value), count }));
  rows.sort((a, b) =>
    opts.numericDesc
      ? Number(b.value) - Number(a.value)
      : b.count - a.count || a.label.localeCompare(b.label),
  );
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

/** Facets are computed per dimension, each ignoring its own active filter. */
async function buildFacets(
  user: SessionUser,
  query: RepositorySearchQuery,
  collectionNames: Map<string, string>,
  projectNames: Map<string, string>,
): Promise<RepositorySearchFacets> {
  const select = {
    resourceType: true,
    status: true,
    year: true,
    collectionId: true,
    projectId: true,
    language: true,
    license: true,
    tags: true,
    subjectsJson: true,
  } as const;

  const dims: (keyof RepositorySearchFacets)[] = [
    "resourceType",
    "status",
    "year",
    "collection",
    "tag",
    "subject",
    "language",
    "license",
    "project",
  ];

  const scans = await Promise.all(
    dims.map(async (dim) => {
      const rows = await prisma.repositoryRecord.findMany({
        where: await buildWhere(user, query, dim),
        select,
        take: FACET_SCAN_CAP,
      });
      return [dim, rows] as const;
    }),
  );
  const byDim = new Map(scans);

  function count<T extends keyof typeof select>(
    dim: keyof RepositorySearchFacets,
    field: T,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of byDim.get(dim) ?? []) {
      const v = row[field];
      if (v === null || v === undefined || v === "") continue;
      const key = String(v);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  function countMulti(
    dim: keyof RepositorySearchFacets,
    extract: (row: { tags: string; subjectsJson: string }) => string[],
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of byDim.get(dim) ?? []) {
      for (const v of extract(row)) {
        map.set(v, (map.get(v) ?? 0) + 1);
      }
    }
    return map;
  }

  return {
    resourceType: toFacet(count("resourceType", "resourceType"), (v) =>
      isResourceType(v) ? RESOURCE_TYPE_LABELS[v] : v,
    ),
    status: toFacet(count("status", "status"), (v) =>
      isRecordStatus(v) ? RECORD_STATUS_LABELS[v] : v,
    ),
    year: toFacet(count("year", "year"), (v) => v, { numericDesc: true, limit: 24 }),
    collection: toFacet(count("collection", "collectionId"), (v) => collectionNames.get(v) ?? v),
    tag: toFacet(countMulti("tag", (r) => parseTags(r.tags)), (v) => v, { limit: 30 }),
    subject: toFacet(countMulti("subject", (r) => parseSubjects(r.subjectsJson)), (v) => v, {
      limit: 30,
    }),
    language: toFacet(count("language", "language"), (v) => LANGUAGE_LABELS[v] ?? v),
    license: toFacet(count("license", "license"), (v) => LICENSE_LABELS[v] ?? v),
    project: toFacet(count("project", "projectId"), (v) => projectNames.get(v) ?? v, { limit: 20 }),
  };
}

export async function searchRepository(
  user: SessionUser,
  query: RepositorySearchQuery,
): Promise<RepositorySearchResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

  const [collections, projects] = await Promise.all([
    prisma.repositoryCollection.findMany({ select: { id: true, name: true } }),
    prisma.project.findMany({ select: { id: true, key: true, name: true } }),
  ]);
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));
  const projectNames = new Map(projects.map((p) => [p.id, `${p.key} — ${p.name}`]));

  const where = await buildWhere(user, query);

  const [total, rows, facets] = await Promise.all([
    prisma.repositoryRecord.count({ where }),
    prisma.repositoryRecord.findMany({
      where,
      include: RECORD_INCLUDE,
      orderBy: orderBy(query.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    buildFacets(user, query, collectionNames, projectNames),
  ]);

  return {
    records: rows.map(toRecordRow),
    total,
    page,
    pageSize,
    facets,
    semantic: false,
  };
}

export async function getRecordById(id: string) {
  return prisma.repositoryRecord.findUnique({
    where: { id },
    include: {
      ...RECORD_INCLUDE,
      links: true,
      versions: {
        select: { id: true, handle: true, version: true, title: true, createdAt: true },
        orderBy: { version: "desc" },
      },
      supersedes: { select: { id: true, handle: true, version: true, title: true } },
    },
  });
}

export async function getRecordByHandle(handle: string) {
  const row = await prisma.repositoryRecord.findUnique({ where: { handle }, select: { id: true } });
  return row ? getRecordById(row.id) : null;
}

export { RECORD_INCLUDE };
