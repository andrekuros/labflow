import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds, writableMap } from "@/lib/projects";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { EmptyState } from "@/components/ui";
import { PlanningPage } from "@/components/planning/planning-page";

export default async function PlanningPluginPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; tab?: string }>;
}) {
  const session = await requireUser();
  await ensurePluginRegistry();
  const { project: projectParam, tab } = await searchParams;
  const ids = await viewableProjectIds(session);

  if (ids.length === 0) {
    return <EmptyState title="Nenhum projeto" description="Participe de um projeto para acessar o planejamento." />;
  }

  const projects = await prisma.project.findMany({
    where: { id: { in: ids } },
    orderBy: { name: "asc" },
  });

  const selectedId = projectParam && ids.includes(projectParam) ? projectParam : ids[0];
  const canWrite = await writableMap(session, ids);

  const [requirements, deliverables, milestones, sprints, workPackages, systemElements, reqStats] =
    await Promise.all([
      prisma.requirement.findMany({
        where: { projectId: selectedId },
        include: {
          project: true,
          deliverables: true,
          activities: true,
          allocatedTo: true,
          verificationCases: true,
          parent: true,
        },
        orderBy: [{ level: "asc" }, { code: "asc" }],
      }),
      prisma.deliverable.findMany({
        where: { projectId: selectedId },
        include: { project: true, workPackage: true, requirements: true },
        orderBy: [{ dueDate: "asc" }],
      }),
      prisma.milestone.findMany({
        where: { projectId: selectedId },
        include: { project: true },
      }),
      prisma.sprint.findMany({
        where: { projectId: selectedId },
        include: { project: true, tasks: { select: { status: true } } },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
      }),
      prisma.workPackage.findMany({ where: { projectId: selectedId } }),
      prisma.systemElement.findMany({ where: { projectId: selectedId } }),
      prisma.requirement.groupBy({
        by: ["status"],
        where: { projectId: selectedId },
        _count: true,
      }),
    ]);

  const roadmapSettings = getPluginSettings("roadmap");
  const showSprintsOnRoadmap = roadmapSettings.showSprints !== false;

  const mappedReqs = requirements.map((r) => ({
    id: r.id, code: r.code, title: r.title, description: r.description,
    kind: r.kind, level: r.level, status: r.status, priority: r.priority,
    projectId: r.projectId, parentId: r.parentId,
    project: { id: r.project.id, key: r.project.key, name: r.project.name, color: r.project.color },
    activities: r.activities.map((a) => ({ id: a.id, name: a.name, code: a.code })),
    deliverables: r.deliverables.map((d) => ({ id: d.id, name: d.name })),
    allocatedTo: r.allocatedTo ? { id: r.allocatedTo.id, name: r.allocatedTo.name } : null,
    verificationCases: r.verificationCases.map((v) => ({ id: v.id, name: v.name, status: v.status })),
  }));

  const mappedDeliverables = deliverables.map((d) => ({
    id: d.id, name: d.name, description: d.description, acceptance: d.acceptance,
    status: d.status, dueDate: d.dueDate ? d.dueDate.toISOString() : null,
    projectId: d.projectId,
    project: { id: d.project.id, key: d.project.key, name: d.project.name, color: d.project.color },
    workPackage: d.workPackage ? { id: d.workPackage.id, name: d.workPackage.name, code: d.workPackage.code } : null,
    requirements: d.requirements.map((r) => ({ id: r.id, title: r.title, code: r.code })),
  }));

  const mappedMilestones = milestones.filter((m) => m.date).map((m) => ({
    id: m.id, name: m.name, description: m.description, kind: m.kind,
    gate: m.gate, status: m.status, date: m.date!.toISOString(),
    projectId: m.projectId,
    project: { key: m.project.key, color: m.project.color },
  }));

  const mappedSprints = sprints.map((s) => ({
    id: s.id, name: s.name, goal: s.goal, status: s.status,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    endDate: s.endDate ? s.endDate.toISOString() : null,
    projectId: s.projectId,
    project: { key: s.project.key, color: s.project.color },
    tasksDone: s.tasks.filter((t) => t.status === "done").length,
    tasksTotal: s.tasks.length,
  }));

  const approved = reqStats.filter((r) => r.status === "approved").reduce((s, r) => s + r._count, 0);
  const totalReqs = reqStats.reduce((s, r) => s + r._count, 0);

  return (
    <PlanningPage
      projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }))}
      selectedProjectId={selectedId}
      initialTab={tab ?? "requirements"}
      canWrite={canWrite[selectedId] ?? false}
      requirements={mappedReqs}
      activities={workPackages.map((a) => ({ id: a.id, name: a.name, code: a.code, projectId: a.projectId }))}
      systemElements={systemElements.map((e) => ({ id: e.id, name: e.name, projectId: e.projectId }))}
      deliverables={mappedDeliverables}
      workPackages={workPackages.map((w) => ({ id: w.id, name: w.name, code: w.code, projectId: w.projectId }))}
      allRequirements={requirements.map((r) => ({ id: r.id, title: r.title, code: r.code, projectId: r.projectId, level: r.level }))}
      milestones={mappedMilestones}
      sprints={mappedSprints}
      showSprintsOnRoadmap={showSprintsOnRoadmap}
      reqApproved={approved}
      reqTotal={totalReqs}
    />
  );
}
