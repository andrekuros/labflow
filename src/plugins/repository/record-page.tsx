import { notFound } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import {
  canDeleteRecord,
  canEditRecord,
  canManageRepository,
  canViewRecord,
  canViewRepository,
} from "@/lib/repository/access";
import { collectionBreadcrumb, flattenCollections, getCollectionTree } from "@/lib/repository/collections";
import { getRecordById, toRecordRow } from "@/lib/repository/search";
import { REPOSITORY_ACCEPTED_EXTENSIONS } from "@/lib/repository/storage";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { registerView } from "@/plugins/repository/actions";
import { RecordDetailClient } from "@/components/repository/record-detail-client";

export default async function RepositoryRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
  await ensurePluginRegistry();
  const { id } = await params;

  if (!(await canViewRepository(session))) notFound();
  const record = await getRecordById(id);
  if (!record || !(await canViewRecord(session, record))) notFound();

  const settings = getPluginSettings("repository");
  const [canEdit, canDelete, canManage, canAskAi, canCreate, scope, collectionTree] =
    await Promise.all([
      canEditRecord(session, record),
      canDeleteRecord(session, record),
      canManageRepository(session),
      hasPermission(session, "assistant:use"),
      hasPermission(session, "repository:create"),
      resolveWorkspaceScope(session),
      getCollectionTree(session),
    ]);

  const [projects, breadcrumb, linkLabels] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: scope.projectIds } },
      select: { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    }),
    record.collectionId ? collectionBreadcrumb(record.collectionId) : Promise.resolve([]),
    resolveLinkLabels(record.links),
  ]);

  // Fire-and-forget: a failed counter must never break the page.
  void registerView(record.id);

  return (
    <RecordDetailClient
      record={{
        ...toRecordRow(record),
        notes: record.notes,
        rights: record.rights,
        isbn: record.isbn,
        issn: record.issn,
        externalUrl: record.externalUrl,
        citation: record.citation,
        publishedAt: record.publishedAt?.toISOString() ?? null,
        hasFullText: record.fullText.length > 0,
        fullTextChars: record.fullText.length,
      }}
      files={record.files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        byteSize: f.byteSize,
        bundle: f.bundle,
        checksum: f.checksum,
        hasText: f.extractedText.length > 0,
      }))}
      links={record.links.map((l) => ({
        id: l.id,
        targetType: l.targetType,
        targetId: l.targetId,
        label: linkLabels.get(`${l.targetType}:${l.targetId}`) ?? l.targetId,
      }))}
      versions={record.versions.map((v) => ({
        id: v.id,
        handle: v.handle,
        version: v.version,
        title: v.title,
      }))}
      supersedes={record.supersedes}
      breadcrumb={breadcrumb}
      permissions={{ canEdit, canDelete, canManage, canAskAi: canAskAi && settings.askAiEnabled !== false, canCreate }}
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

/** Human labels for linked LabFlow entities, one query per type. */
async function resolveLinkLabels(
  links: { targetType: string; targetId: string }[],
): Promise<Map<string, string>> {
  const byType = new Map<string, string[]>();
  for (const l of links) {
    byType.set(l.targetType, [...(byType.get(l.targetType) ?? []), l.targetId]);
  }
  const ids = (t: string) => byType.get(t) ?? [];
  const labels = new Map<string, string>();

  const [projects, tasks, deliverables, requirements, articles, records, users] = await Promise.all([
    ids("project").length
      ? prisma.project.findMany({ where: { id: { in: ids("project") } }, select: { id: true, key: true, name: true } })
      : [],
    ids("task").length
      ? prisma.task.findMany({ where: { id: { in: ids("task") } }, select: { id: true, title: true } })
      : [],
    ids("deliverable").length
      ? prisma.deliverable.findMany({ where: { id: { in: ids("deliverable") } }, select: { id: true, name: true } })
      : [],
    ids("requirement").length
      ? prisma.requirement.findMany({
          where: { id: { in: ids("requirement") } },
          select: { id: true, code: true, title: true },
        })
      : [],
    ids("article").length
      ? prisma.knowledgeArticle.findMany({ where: { id: { in: ids("article") } }, select: { id: true, title: true } })
      : [],
    ids("record").length
      ? prisma.repositoryRecord.findMany({
          where: { id: { in: ids("record") } },
          select: { id: true, title: true, handle: true },
        })
      : [],
    ids("user").length
      ? prisma.user.findMany({ where: { id: { in: ids("user") } }, select: { id: true, name: true } })
      : [],
  ]);

  for (const p of projects) labels.set(`project:${p.id}`, `${p.key} — ${p.name}`);
  for (const t of tasks) labels.set(`task:${t.id}`, t.title);
  for (const d of deliverables) labels.set(`deliverable:${d.id}`, d.name);
  for (const r of requirements) labels.set(`requirement:${r.id}`, r.code ? `${r.code} — ${r.title}` : r.title);
  for (const a of articles) labels.set(`article:${a.id}`, a.title);
  for (const r of records) labels.set(`record:${r.id}`, `${r.title} [${r.handle}]`);
  for (const u of users) labels.set(`user:${u.id}`, u.name);

  return labels;
}
