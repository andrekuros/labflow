import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { canViewProject, canWriteProject, canManageProject, canAssignProjectLead } from "@/lib/rbac";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { parseConops } from "@/lib/artifacts/schema";
import { getExistingArtifactSummary } from "@/lib/artifacts/existing-summary";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";
import { getProjectBoardSettings } from "@/plugins/projects/actions";
import { computeWbsProgressMap, computeProjectProgress } from "@/lib/wbs-progress";
import { parseChecklist, checklistProgress } from "@/lib/task-checklist";
import { isProjectKind, parseProjectFeatures } from "@/lib/projects/features";
import { parseAcademicMeta } from "@/lib/projects/academic-meta";
import { parsePaperMeta } from "@/lib/projects/paper-meta";
import { PROJECT_BUNDLE_FORMAT_DOC_TITLE } from "@/lib/data-transfer/format-doc";
import { listProjectLibraryArticles } from "@/lib/knowledge/project-files";
import { vaultProjectRoot } from "@/lib/knowledge/vault-layout";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await requireUser();
  if (!(await canViewProject(session, id))) notFound();
  const writable = await canWriteProject(session, id);
  const canManage = await canManageProject(session, id);
  const canAssignLead = canAssignProjectLead(session);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      workPackages: { orderBy: [{ order: "asc" }], include: { _count: { select: { tasks: true } } } },
      labels: true,
      memberships: { include: { user: { include: { profiles: { select: { profile: true } } } } } },
      sprints: { orderBy: { createdAt: "desc" } },
      _count: { select: { tasks: true, deliverables: true, requirements: true } },
    },
  });
  if (!project) notFound();

  const [openTasks, deliverables, libraryFiles, channels, taskIds, deliverableIds, requirementIds, reqApproved, reqTotal, vvPassed, vvTotal, systemElementCount, pendingDrafts, formatDoc, projectBundleFormatDoc, artifactSummary] = await Promise.all([
    prisma.task.count({ where: { projectId: id, status: { not: "done" } } }),
    prisma.deliverable.findMany({
      where: { projectId: id, status: { notIn: ["accepted", "rejected"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    listProjectLibraryArticles(id),
    prisma.channel.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.task.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.deliverable.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.requirement.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.requirement.count({ where: { projectId: id, status: "approved" } }),
    prisma.requirement.count({ where: { projectId: id } }),
    prisma.verificationCase.count({ where: { projectId: id, status: "passed" } }),
    prisma.verificationCase.count({ where: { projectId: id } }),
    prisma.systemElement.count({ where: { projectId: id } }),
    prisma.aiDraft.findMany({
      where: { projectId: id, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.knowledgeArticle.findFirst({
      where: { title: "Formato JSON de artefatos LabFlow", projectId: null },
      select: { id: true },
    }),
    prisma.knowledgeArticle.findFirst({
      where: { title: PROJECT_BUNDLE_FORMAT_DOC_TITLE, projectId: null },
      select: { id: true },
    }),
    getExistingArtifactSummary(id),
  ]);

  const linkCount = await prisma.knowledgeLink.count({
    where: {
      OR: [
        { targetType: "task", targetId: { in: taskIds.map((t) => t.id) } },
        { targetType: "deliverable", targetId: { in: deliverableIds.map((d) => d.id) } },
        { targetType: "requirement", targetId: { in: requirementIds.map((r) => r.id) } },
      ],
    },
  });

  const threads = channels.length
    ? await prisma.thread.findMany({
        where: { channelId: { in: channels.map((c) => c.id) } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      })
    : [];

  const activeSprint = project.sprints.find((s) => s.status === "active") ?? project.sprints[0] ?? null;
  const boardColumns = await getProjectBoardSettings(id);

  const projectTasks = await prisma.task.findMany({
    where: { projectId: id },
    include: {
      assignees: { select: { id: true, name: true, avatarColor: true } },
      sprint: { select: { id: true, name: true } },
      workPackage: { select: { id: true, code: true, name: true } },
      labels: { select: { id: true, name: true, color: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const wbsNodes = project.workPackages.map((w) => ({ id: w.id, parentId: w.parentId }));
  const taskProgressInputs = projectTasks.map((t) => ({
    id: t.id,
    workPackageId: t.workPackageId,
    status: t.status,
    estimate: t.estimate,
  }));
  const wbsProgressMap = computeWbsProgressMap(wbsNodes, taskProgressInputs);
  const projectProgress = computeProjectProgress(taskProgressInputs);

  const allUsers = await prisma.user.findMany({
    where: { accountStatus: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const memberIds = new Set(project.memberships.map((m) => m.userId));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id)).map((u) => ({ id: u.id, name: u.name }));
  const kind = isProjectKind(project.kind) ? project.kind : "lab";
  const features = parseProjectFeatures(project.featuresJson, kind);
  const academicMeta = parseAcademicMeta(project.academicJson);
  const paperMeta = parsePaperMeta(project.paperJson);

  return (
    <ProjectDetailClient
      project={{
        id: project.id,
        key: project.key,
        name: project.name,
        color: project.color,
        description: project.description,
        status: project.status,
        kind,
        taskCount: project._count.tasks,
        deliverableCount: project._count.deliverables,
        requirementCount: project._count.requirements,
      }}
      features={features}
      academicMeta={academicMeta}
      paperMeta={paperMeta}
      writable={writable}
      canManage={canManage}
      canAssignLead={canAssignLead}
      boardColumns={boardColumns}
      initialTab={tab ?? "overview"}
      pendingDraftCount={pendingDrafts.length}
      conops={parseConops(project.conops)}
      formatDocId={formatDoc?.id}
      projectBundleFormatDocId={projectBundleFormatDoc?.id}
      artifactCounts={artifactSummary.counts}
      drafts={pendingDrafts.map((d) => ({
        id: d.id,
        artifactType: d.artifactType,
        title: d.title,
        payload: d.payload,
        source: d.source,
        createdAt: d.createdAt.toISOString(),
      }))}
      cockpit={{
        project: { id: project.id, key: project.key, name: project.name, color: project.color },
        activeSprint: activeSprint
          ? {
              id: activeSprint.id,
              name: activeSprint.name,
              goal: activeSprint.goal,
              endDate: activeSprint.endDate?.toISOString() ?? null,
            }
          : null,
        openTasks,
        deliverables: deliverables.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          dueDate: d.dueDate?.toISOString() ?? null,
        })),
        articles: libraryFiles.slice(0, 4).map((a) => ({
          id: a.id,
          title: a.title,
          externalSource: a.externalSource,
          updatedAt: a.updatedAt,
        })),
        fileCount: libraryFiles.length,
        libraryFolder: vaultProjectRoot(kind, project.key),
        threads: threads.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          updatedAt: t.updatedAt.toISOString(),
        })),
        linkCount,
        seMaturity: { approved: reqApproved, total: reqTotal },
        vvPassed,
        vvTotal,
        systemElementCount,
        projectProgress: {
          progressPct: projectProgress.progressPct,
          doneTasks: projectProgress.doneTasks,
          totalTasks: projectProgress.totalTasks,
          doneWeight: projectProgress.doneWeight,
          totalWeight: projectProgress.totalWeight,
          unmappedTasks: projectProgress.unmappedTasks,
        },
      }}
      workPackages={project.workPackages.map((w) => {
        const metrics = wbsProgressMap.get(w.id);
        return {
          id: w.id,
          parentId: w.parentId,
          code: w.code,
          name: w.name,
          description: w.description,
          status: w.status,
          order: w.order,
          taskCount: metrics?.totalTasks ?? w._count.tasks,
          progressPct: metrics?.progressPct ?? 0,
          doneTasks: metrics?.doneTasks ?? 0,
          totalTasks: metrics?.totalTasks ?? 0,
          doneWeight: metrics?.doneWeight ?? 0,
          totalWeight: metrics?.totalWeight ?? 0,
        };
      })}
      tasks={projectTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        estimate: t.estimate,
        dueDate: t.dueDate?.toISOString() ?? null,
        updatedAt: t.updatedAt.toISOString(),
        workPackageId: t.workPackageId,
        workPackageCode: t.workPackage?.code ?? null,
        workPackageName: t.workPackage?.name ?? null,
        sprintId: t.sprintId,
        sprintName: t.sprint?.name ?? null,
        assignees: t.assignees.map((a) => ({ id: a.id, name: a.name, avatarColor: a.avatarColor })),
        labels: t.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
        checklistDone: checklistProgress(parseChecklist(t.checklistJson)).done,
        checklistTotal: checklistProgress(parseChecklist(t.checklistJson)).total,
      }))}
      members={project.memberships.map((m) => {
        const profiles = m.user.profiles?.length
          ? normalizeProfiles(m.user.profiles.map((p) => p.profile))
          : legacyRoleToProfiles(m.user.role);
        return {
          id: m.id,
          userId: m.userId,
          userName: m.user.name,
          userProfilesLabel: formatProfilesLabel(profiles),
          userRole: m.user.role,
          avatarColor: m.user.avatarColor,
          role: m.role,
        };
      })}
      labels={project.labels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      sprints={project.sprints.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
      memberCandidates={candidates}
      libraryFiles={libraryFiles}
      libraryFolder={vaultProjectRoot(kind, project.key)}
    />
  );
}
