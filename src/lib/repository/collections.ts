import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { collectionVisibilityWhere, recordVisibilityWhere } from "@/lib/repository/access";
import type { RepositoryCollectionNode } from "@/lib/repository/search-types";

/**
 * Collection tree with record counts. `recordCount` is the collection's own
 * deposits; `totalRecordCount` includes descendants, which is what a browse
 * sidebar needs to show a community's real size.
 */
export async function getCollectionTree(user: SessionUser): Promise<RepositoryCollectionNode[]> {
  const [collections, counts] = await Promise.all([
    prisma.repositoryCollection.findMany({
      where: await collectionVisibilityWhere(user),
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.repositoryRecord.groupBy({
      by: ["collectionId"],
      where: await recordVisibilityWhere(user),
      _count: true,
    }),
  ]);

  const ownCount = new Map<string, number>();
  for (const c of counts) {
    if (c.collectionId) ownCount.set(c.collectionId, c._count);
  }

  const nodes = new Map<string, RepositoryCollectionNode>();
  for (const c of collections) {
    nodes.set(c.id, {
      id: c.id,
      parentId: c.parentId,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      color: c.color,
      visibility: c.visibility,
      order: c.order,
      recordCount: ownCount.get(c.id) ?? 0,
      totalRecordCount: 0,
      depth: 0,
      children: [],
    });
  }

  const roots: RepositoryCollectionNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Post-order: a parent's total needs its children's totals first.
  function finish(node: RepositoryCollectionNode, depth: number, seen: Set<string>): number {
    if (seen.has(node.id)) return 0; // defensive: a cycle must not hang the page
    seen.add(node.id);
    node.depth = depth;
    let total = node.recordCount;
    for (const child of node.children) total += finish(child, depth + 1, seen);
    node.totalRecordCount = total;
    return total;
  }
  const seen = new Set<string>();
  for (const root of roots) finish(root, 0, seen);

  return roots;
}

/** Depth-first flatten, for selects and breadcrumbs. */
export function flattenCollections(
  nodes: RepositoryCollectionNode[],
): RepositoryCollectionNode[] {
  const out: RepositoryCollectionNode[] = [];
  function walk(list: RepositoryCollectionNode[]) {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

export async function collectionBreadcrumb(
  collectionId: string,
): Promise<{ id: string; name: string; slug: string }[]> {
  const all = await prisma.repositoryCollection.findMany({
    select: { id: true, name: true, slug: true, parentId: true },
  });
  const byId = new Map(all.map((c) => [c.id, c]));
  const trail: { id: string; name: string; slug: string }[] = [];
  let cursor = byId.get(collectionId);
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    trail.unshift({ id: cursor.id, name: cursor.name, slug: cursor.slug });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return trail;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "colecao"
  );
}

/** Unique slug, suffixing `-2`, `-3`… on collision. */
export async function uniqueCollectionSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  while (await prisma.repositoryCollection.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

/**
 * Next stable handle, e.g. `labflow/2026/000042`. Sequence is per year and
 * derived from the highest existing number, so deleting a record never causes a
 * handle to be reused.
 */
export async function nextHandle(prefix: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const clean = (prefix || "labflow").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() || "labflow";
  const scope = `${clean}/${year}/`;

  const existing = await prisma.repositoryRecord.findMany({
    where: { handle: { startsWith: scope } },
    select: { handle: true },
  });
  let max = 0;
  for (const row of existing) {
    const n = Number(row.handle.slice(scope.length));
    if (Number.isFinite(n) && n > max) max = n;
  }

  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = `${scope}${String(max + attempt).padStart(6, "0")}`;
    const clash = await prisma.repositoryRecord.findUnique({ where: { handle: candidate } });
    if (!clash) return candidate;
  }
  // Concurrent deposits exhausted the window: fall back to a timestamped handle.
  return `${scope}${Date.now()}`;
}
