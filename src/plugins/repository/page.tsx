import { requireUser, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { canManageRepository, canViewRepository, recordVisibilityWhere } from "@/lib/repository/access";
import { getCollectionTree, flattenCollections } from "@/lib/repository/collections";
import { searchRepository } from "@/lib/repository/search";
import { REPOSITORY_ACCEPTED_EXTENSIONS } from "@/lib/repository/storage";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { RepositoryBrowser } from "@/components/repository/repository-browser";
import type { RepositorySearchQuery } from "@/lib/repository/search-types";

export default async function RepositoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  await ensurePluginRegistry();
  const params = await searchParams;

  if (!(await canViewRepository(session))) {
    return (
      <EmptyState
        title="Sem permissao"
        description="Voce nao tem permissao para acessar o repositorio."
      />
    );
  }

  const settings = getPluginSettings("repository");
  // Links from a record detail page (?collection=, ?tag=, ?subject=, ?type=, ?q=)
  // must land on a pre-filtered browse, not on an unfiltered list.
  const initialQuery = queryFromParams(params);

  const [collectionTree, initial, canCreate, canManage, canAskAi, scope, stats] = await Promise.all([
    getCollectionTree(session),
    searchRepository(session, initialQuery),
    hasPermission(session, "repository:create"),
    canManageRepository(session),
    hasPermission(session, "assistant:use"),
    resolveWorkspaceScope(session),
    (async () => {
      const where = await recordVisibilityWhere(session);
      const [records, collections, files] = await Promise.all([
        prisma.repositoryRecord.count({ where }),
        prisma.repositoryCollection.count(),
        prisma.repositoryFile.aggregate({ _count: true, _sum: { byteSize: true } }),
      ]);
      return {
        records,
        collections,
        files: files._count,
        totalBytes: files._sum.byteSize ?? 0,
      };
    })(),
  ]);

  // Project picker follows the workspace context, like every other module.
  const projects = await prisma.project.findMany({
    where: { id: { in: scope.projectIds } },
    select: { id: true, key: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <RepositoryBrowser
      initial={initial}
      initialQuery={initialQuery}
      collections={collectionTree}
      canCreate={canCreate}
      canManage={canManage}
      canAskAi={canAskAi && settings.askAiEnabled !== false}
      stats={stats}
      formOptions={{
        collections: flattenCollections(collectionTree).map((c) => ({
          id: c.id,
          name: c.name,
          depth: c.depth,
        })),
        projects,
        defaultVisibility: String(settings.defaultVisibility ?? "members"),
        maxFileMb: Number(settings.maxFileMb ?? 64),
        acceptedExtensions: REPOSITORY_ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(","),
        canManage,
      }}
    />
  );
}

/** Read the browse filters out of the URL. Unknown params are ignored. */
function queryFromParams(
  params: Record<string, string | string[] | undefined>,
): RepositorySearchQuery {
  const one = (key: string): string | undefined => {
    const v = params[key];
    const raw = Array.isArray(v) ? v[0] : v;
    return raw?.trim() ? raw.trim() : undefined;
  };
  const many = (key: string): string[] | undefined => {
    const v = params[key];
    const values = (Array.isArray(v) ? v : [v])
      .filter((x): x is string => typeof x === "string")
      .flatMap((x) => x.split(","))
      .map((x) => x.trim())
      .filter(Boolean);
    return values.length ? values : undefined;
  };
  const int = (key: string): number | undefined => {
    const n = Number(one(key));
    return Number.isFinite(n) ? n : undefined;
  };
  const sortRaw = one("sort");
  const sorts = ["relevance", "recent", "oldest", "title", "year", "downloads"];

  return {
    q: one("q"),
    collectionId: one("collection") ?? one("collectionId"),
    resourceType: many("resourceType") ?? many("type"),
    status: many("status"),
    tag: many("tag") ?? many("tags"),
    subject: many("subject") ?? many("subjects"),
    language: many("language"),
    license: many("license"),
    projectId: one("project") ?? one("projectId"),
    yearFrom: int("yearFrom"),
    yearTo: int("yearTo"),
    sort: sortRaw && sorts.includes(sortRaw) ? (sortRaw as RepositorySearchQuery["sort"]) : "recent",
    page: int("page") ?? 1,
  };
}
