import "server-only";
import { prisma } from "@/lib/db";
import {
  DATA_TRANSFER_VERSION,
  type ProjectDataBundle,
  type ProjectImportResult,
} from "@/lib/data-transfer/types";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function exportProjectBundle(projectId: string): Promise<ProjectDataBundle> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const [
    memberships,
    labels,
    sprints,
    workPackages,
    requirements,
    deliverables,
    systemElements,
    interfaces,
    milestones,
    verificationCases,
    tasks,
    aiDrafts,
    knowledgeArticles,
    pluginSettings,
    channels,
    feedbacks,
  ] = await Promise.all([
    prisma.projectMembership.findMany({
      where: { projectId },
      include: { user: { select: { email: true } } },
    }),
    prisma.label.findMany({ where: { projectId } }),
    prisma.sprint.findMany({ where: { projectId } }),
    prisma.workPackage.findMany({ where: { projectId } }),
    prisma.requirement.findMany({
      where: { projectId },
      include: {
        deliverables: { select: { id: true } },
        activities: { select: { id: true } },
      },
    }),
    prisma.deliverable.findMany({ where: { projectId } }),
    prisma.systemElement.findMany({ where: { projectId } }),
    prisma.interface.findMany({ where: { projectId } }),
    prisma.milestone.findMany({ where: { projectId } }),
    prisma.verificationCase.findMany({ where: { projectId } }),
    prisma.task.findMany({
      where: { projectId },
      include: {
        assignees: { select: { email: true } },
        labels: { select: { name: true } },
        comments: { include: { author: { select: { email: true } } }, orderBy: { createdAt: "asc" } },
        creator: { select: { email: true } },
        workPackage: { select: { id: true } },
        sprint: { select: { id: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.aiDraft.findMany({ where: { projectId } }),
    prisma.knowledgeArticle.findMany({
      where: { projectId },
      include: {
        author: { select: { email: true } },
        links: true,
      },
    }),
    prisma.pluginProjectSettings.findMany({ where: { projectId } }),
    prisma.channel.findMany({
      where: { projectId },
      include: {
        threads: {
          include: {
            author: { select: { email: true } },
            posts: {
              include: { author: { select: { email: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.feedback.findMany({
      where: { projectId },
      include: {
        submittedBy: { select: { email: true } },
        assignee: { select: { email: true } },
      },
    }),
  ]);

  return {
    version: DATA_TRANSFER_VERSION,
    kind: "project",
    exportedAt: new Date().toISOString(),
    project: {
      key: project.key,
      name: project.name,
      description: project.description,
      color: project.color,
      status: project.status,
      projectKind: project.kind,
      featuresJson: project.featuresJson,
      academicJson: project.academicJson,
      paperJson: project.paperJson,
      conops: project.conops,
    },
    memberships: memberships.map((m) => ({ email: m.user.email, role: m.role })),
    labels: labels.map((l) => ({ name: l.name, color: l.color })),
    sprints: sprints.map((s) => ({
      _ref: s.id,
      name: s.name,
      goal: s.goal,
      startDate: iso(s.startDate),
      endDate: iso(s.endDate),
      status: s.status,
    })),
    workPackages: workPackages.map((w) => ({
      _ref: w.id,
      code: w.code,
      name: w.name,
      description: w.description,
      status: w.status,
      order: w.order,
      parentRef: w.parentId,
    })),
    requirements: requirements.map((r) => ({
      _ref: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      level: r.level,
      source: r.source,
      kind: r.kind,
      priority: r.priority,
      status: r.status,
      parentRef: r.parentId,
      allocatedToRef: r.allocatedToId,
      deliverableRefs: r.deliverables.map((d) => d.id),
      activityRefs: r.activities.map((a) => a.id),
    })),
    deliverables: deliverables.map((d) => ({
      _ref: d.id,
      name: d.name,
      description: d.description,
      acceptance: d.acceptance,
      status: d.status,
      dueDate: iso(d.dueDate),
      workPackageRef: d.workPackageId,
    })),
    systemElements: systemElements.map((e) => ({
      _ref: e.id,
      name: e.name,
      description: e.description,
      kind: e.kind,
      diagram: e.diagram,
      order: e.order,
      parentRef: e.parentId,
    })),
    interfaces: interfaces.map((i) => ({
      _ref: i.id,
      name: i.name,
      description: i.description,
      kind: i.kind,
      protocol: i.protocol,
      fromRef: i.fromId,
      toRef: i.toId,
    })),
    milestones: milestones.map((m) => ({
      _ref: m.id,
      name: m.name,
      description: m.description,
      kind: m.kind,
      gate: m.gate,
      date: iso(m.date),
      status: m.status,
    })),
    verificationCases: verificationCases.map((v) => ({
      _ref: v.id,
      name: v.name,
      method: v.method,
      status: v.status,
      result: v.result,
      evidence: v.evidence,
      requirementRef: v.requirementId,
      milestoneRef: v.milestoneId,
    })),
    tasks: tasks.map((t) => ({
      _ref: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      estimate: t.estimate,
      startDate: iso(t.startDate),
      dueDate: iso(t.dueDate),
      order: t.order,
      workPackageRef: t.workPackage?.id ?? null,
      sprintRef: t.sprint?.id ?? null,
      creatorEmail: t.creator?.email ?? null,
      assigneeEmails: t.assignees.map((a) => a.email),
      labelNames: t.labels.map((l) => l.name),
      comments: t.comments.map((c) => ({
        authorEmail: c.author?.email ?? null,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
    })),
    aiDrafts: aiDrafts.map((d) => ({
      artifactType: d.artifactType,
      title: d.title,
      payload: d.payload,
      source: d.source,
      status: d.status,
    })),
    knowledgeArticles: knowledgeArticles.map((a) => ({
      _ref: a.id,
      title: a.title,
      content: a.content,
      tags: a.tags,
      externalSource: a.externalSource,
      externalPath: a.externalPath,
      externalFolder: a.externalFolder,
      externalEtag: a.externalEtag,
      externalStatus: a.externalStatus,
      externalSyncedAt: iso(a.externalSyncedAt),
      authorEmail: a.author?.email ?? null,
      links: a.links.map((l) => ({ targetType: l.targetType, targetRef: l.targetId })),
    })),
    pluginSettings: pluginSettings.map((p) => ({ pluginId: p.pluginId, settings: p.settings })),
    channels: channels.map((c) => ({
      _ref: c.id,
      name: c.name,
      description: c.description,
      threads: c.threads.map((t) => ({
        _ref: t.id,
        title: t.title,
        status: t.status,
        pinned: t.pinned,
        authorEmail: t.author?.email ?? null,
        posts: t.posts.map((p) => ({
          authorEmail: p.author?.email ?? null,
          content: p.content,
          createdAt: p.createdAt.toISOString(),
        })),
      })),
    })),
    feedbacks: feedbacks.map((f) => ({
      title: f.title,
      description: f.description,
      category: f.category,
      status: f.status,
      platformUrl: f.platformUrl,
      submittedByEmail: f.submittedBy.email,
      assigneeEmail: f.assignee?.email ?? null,
      linkedDrafts: f.linkedDrafts,
    })),
  };
}

function parseBundle(raw: string): ProjectDataBundle {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("JSON invalido");
  }
  if (!data || typeof data !== "object") throw new Error("JSON invalido");
  const bundle = data as Partial<ProjectDataBundle>;
  if (bundle.kind !== "project" || bundle.version !== DATA_TRANSFER_VERSION) {
    throw new Error(`Formato invalido. Esperado project bundle v${DATA_TRANSFER_VERSION}`);
  }
  if (!bundle.project?.key || !bundle.project?.name) {
    throw new Error("Bundle sem dados do projeto (key, name)");
  }
  return bundle as ProjectDataBundle;
}

async function resolveUserId(email: string | null | undefined, warnings: string[]): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) warnings.push(`Usuario nao encontrado: ${email}`);
  return user?.id ?? null;
}

export async function importProjectBundle(
  raw: string,
  opts: { keyOverride?: string } = {},
): Promise<ProjectImportResult> {
  const bundle = parseBundle(raw);
  const warnings: string[] = [];
  const created: Record<string, number> = {};
  const inc = (k: string) => {
    created[k] = (created[k] ?? 0) + 1;
  };

  const projectKey = (opts.keyOverride ?? bundle.project.key).toUpperCase();
  const existing = await prisma.project.findUnique({ where: { key: projectKey } });
  if (existing) {
    throw new Error(`Projeto com sigla ${projectKey} ja existe. Use outra sigla na importacao.`);
  }

  const refMap = new Map<string, string>();

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        key: projectKey,
        name: bundle.project.name,
        description: bundle.project.description,
        color: bundle.project.color,
        status: bundle.project.status,
        conops: bundle.project.conops,
        kind: bundle.project.projectKind ?? "lab",
        featuresJson: bundle.project.featuresJson ?? "{}",
        academicJson: bundle.project.academicJson ?? "{}",
        paperJson: bundle.project.paperJson ?? "{}",
      },
    });
    inc("project");

    for (const label of bundle.labels ?? []) {
      await tx.label.create({
        data: { projectId: project.id, name: label.name, color: label.color },
      });
      inc("labels");
    }

    for (const wp of bundle.workPackages ?? []) {
      const row = await tx.workPackage.create({
        data: {
          projectId: project.id,
          code: wp.code,
          name: wp.name,
          description: wp.description,
          status: wp.status,
          order: wp.order,
        },
      });
      refMap.set(wp._ref, row.id);
      inc("workPackages");
    }
    for (const wp of bundle.workPackages ?? []) {
      if (!wp.parentRef) continue;
      const id = refMap.get(wp._ref);
      const parentId = refMap.get(wp.parentRef);
      if (id && parentId) await tx.workPackage.update({ where: { id }, data: { parentId } });
    }

    for (const el of bundle.systemElements ?? []) {
      const row = await tx.systemElement.create({
        data: {
          projectId: project.id,
          name: el.name,
          description: el.description,
          kind: el.kind,
          diagram: el.diagram,
          order: el.order,
        },
      });
      refMap.set(el._ref, row.id);
      inc("systemElements");
    }
    for (const el of bundle.systemElements ?? []) {
      if (!el.parentRef) continue;
      const id = refMap.get(el._ref);
      const parentId = refMap.get(el.parentRef);
      if (id && parentId) await tx.systemElement.update({ where: { id }, data: { parentId } });
    }

    for (const req of bundle.requirements ?? []) {
      const row = await tx.requirement.create({
        data: {
          projectId: project.id,
          code: req.code,
          title: req.title,
          description: req.description,
          level: req.level,
          source: req.source,
          kind: req.kind,
          priority: req.priority,
          status: req.status,
          allocatedToId: req.allocatedToRef ? refMap.get(req.allocatedToRef) ?? null : null,
        },
      });
      refMap.set(req._ref, row.id);
      inc("requirements");
    }
    for (const req of bundle.requirements ?? []) {
      if (!req.parentRef) continue;
      const id = refMap.get(req._ref);
      const parentId = refMap.get(req.parentRef);
      if (id && parentId) await tx.requirement.update({ where: { id }, data: { parentId } });
    }

    for (const d of bundle.deliverables ?? []) {
      const row = await tx.deliverable.create({
        data: {
          projectId: project.id,
          name: d.name,
          description: d.description,
          acceptance: d.acceptance,
          status: d.status,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          workPackageId: d.workPackageRef ? refMap.get(d.workPackageRef) ?? null : null,
        },
      });
      refMap.set(d._ref, row.id);
      inc("deliverables");
    }

    for (const req of bundle.requirements ?? []) {
      const reqId = refMap.get(req._ref);
      if (!reqId) continue;
      const deliverableIds = req.deliverableRefs.map((r) => refMap.get(r)).filter(Boolean) as string[];
      const activityIds = req.activityRefs.map((r) => refMap.get(r)).filter(Boolean) as string[];
      if (deliverableIds.length || activityIds.length) {
        await tx.requirement.update({
          where: { id: reqId },
          data: {
            deliverables: deliverableIds.length ? { connect: deliverableIds.map((id) => ({ id })) } : undefined,
            activities: activityIds.length ? { connect: activityIds.map((id) => ({ id })) } : undefined,
          },
        });
      }
    }

    for (const m of bundle.milestones ?? []) {
      const row = await tx.milestone.create({
        data: {
          projectId: project.id,
          name: m.name,
          description: m.description,
          kind: m.kind,
          gate: m.gate,
          date: m.date ? new Date(m.date) : null,
          status: m.status,
        },
      });
      refMap.set(m._ref, row.id);
      inc("milestones");
    }

    for (const v of bundle.verificationCases ?? []) {
      const requirementId = refMap.get(v.requirementRef);
      if (!requirementId) {
        warnings.push(`Caso de verificacao ignorado (requisito ausente): ${v.name}`);
        continue;
      }
      const row = await tx.verificationCase.create({
        data: {
          projectId: project.id,
          requirementId,
          milestoneId: v.milestoneRef ? refMap.get(v.milestoneRef) ?? null : null,
          name: v.name,
          method: v.method,
          status: v.status,
          result: v.result,
          evidence: v.evidence,
        },
      });
      refMap.set(v._ref, row.id);
      inc("verificationCases");
    }

    for (const s of bundle.sprints ?? []) {
      const row = await tx.sprint.create({
        data: {
          projectId: project.id,
          name: s.name,
          goal: s.goal,
          startDate: s.startDate ? new Date(s.startDate) : null,
          endDate: s.endDate ? new Date(s.endDate) : null,
          status: s.status,
        },
      });
      refMap.set(s._ref, row.id);
      inc("sprints");
    }

    for (const t of bundle.tasks ?? []) {
      const assigneeIds: string[] = [];
      for (const email of t.assigneeEmails) {
        const id = await resolveUserId(email, warnings);
        if (id) assigneeIds.push(id);
      }
      const labelConnect = t.labelNames
        .map((name) => ({ projectId_name: { projectId: project.id, name } }))
        .filter((_, i) => t.labelNames[i]);

      const task = await tx.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          estimate: t.estimate,
          startDate: t.startDate ? new Date(t.startDate) : null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          order: t.order,
          workPackageId: t.workPackageRef ? refMap.get(t.workPackageRef) ?? null : null,
          sprintId: t.sprintRef ? refMap.get(t.sprintRef) ?? null : null,
          creatorId: await resolveUserId(t.creatorEmail, warnings),
          assignees: assigneeIds.length ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
          labels: labelConnect.length ? { connect: labelConnect } : undefined,
        },
      });
      refMap.set(t._ref, task.id);
      inc("tasks");

      for (const c of t.comments) {
        await tx.comment.create({
          data: {
            taskId: task.id,
            content: c.content,
            createdAt: new Date(c.createdAt),
            authorId: await resolveUserId(c.authorEmail, warnings),
          },
        });
        inc("comments");
      }
    }

    for (const i of bundle.interfaces ?? []) {
      const fromId = refMap.get(i.fromRef);
      const toId = refMap.get(i.toRef);
      if (!fromId || !toId) {
        warnings.push(`Interface ignorada (elementos ausentes): ${i.name}`);
        continue;
      }
      const row = await tx.interface.create({
        data: {
          projectId: project.id,
          fromId,
          toId,
          name: i.name,
          description: i.description,
          kind: i.kind,
          protocol: i.protocol,
        },
      });
      refMap.set(i._ref, row.id);
      inc("interfaces");
    }

    for (const a of bundle.knowledgeArticles ?? []) {
      const article = await tx.knowledgeArticle.create({
        data: {
          projectId: project.id,
          title: a.title,
          content: a.content,
          tags: a.tags,
          externalSource: a.externalSource,
          externalPath: a.externalPath,
          externalFolder: a.externalFolder,
          externalEtag: a.externalEtag,
          externalStatus: a.externalStatus,
          externalSyncedAt: a.externalSyncedAt ? new Date(a.externalSyncedAt) : null,
          authorId: await resolveUserId(a.authorEmail, warnings),
        },
      });
      refMap.set(a._ref, article.id);
      inc("knowledgeArticles");

      for (const link of a.links) {
        const targetId = refMap.get(link.targetRef);
        if (!targetId) continue;
        await tx.knowledgeLink.create({
          data: {
            articleId: article.id,
            targetType: link.targetType,
            targetId,
          },
        });
        inc("knowledgeLinks");
      }
    }

    for (const d of bundle.aiDrafts ?? []) {
      await tx.aiDraft.create({
        data: {
          projectId: project.id,
          artifactType: d.artifactType,
          title: d.title,
          payload: d.payload,
          source: d.source,
          status: d.status,
        },
      });
      inc("aiDrafts");
    }

    for (const ps of bundle.pluginSettings ?? []) {
      await tx.pluginProjectSettings.create({
        data: { projectId: project.id, pluginId: ps.pluginId, settings: ps.settings },
      });
      inc("pluginSettings");
    }

    for (const c of bundle.channels ?? []) {
      const channel = await tx.channel.create({
        data: {
          projectId: project.id,
          name: c.name,
          description: c.description,
        },
      });
      refMap.set(c._ref, channel.id);
      inc("channels");

      for (const th of c.threads) {
        const thread = await tx.thread.create({
          data: {
            channelId: channel.id,
            title: th.title,
            status: th.status,
            pinned: th.pinned,
            authorId: await resolveUserId(th.authorEmail, warnings),
          },
        });
        refMap.set(th._ref, thread.id);
        inc("threads");

        for (const p of th.posts) {
          await tx.post.create({
            data: {
              threadId: thread.id,
              content: p.content,
              createdAt: new Date(p.createdAt),
              authorId: await resolveUserId(p.authorEmail, warnings),
            },
          });
          inc("posts");
        }
      }
    }

    for (const m of bundle.memberships ?? []) {
      const userId = await resolveUserId(m.email, warnings);
      if (!userId) continue;
      await tx.projectMembership.upsert({
        where: { userId_projectId: { userId, projectId: project.id } },
        create: { userId, projectId: project.id, role: m.role },
        update: { role: m.role },
      });
      inc("memberships");
    }

    for (const f of bundle.feedbacks ?? []) {
      const submittedById = await resolveUserId(f.submittedByEmail, warnings);
      if (!submittedById) {
        warnings.push(`Feedback ignorado (autor ausente): ${f.title}`);
        continue;
      }
      await tx.feedback.create({
        data: {
          projectId: project.id,
          title: f.title,
          description: f.description,
          category: f.category,
          status: f.status,
          platformUrl: f.platformUrl,
          submittedById,
          assigneeId: await resolveUserId(f.assigneeEmail, warnings),
          linkedDrafts: f.linkedDrafts,
        },
      });
      inc("feedbacks");
    }

    return project;
  });

  return {
    projectId: result.id,
    projectKey: result.key,
    created,
    warnings,
  };
}
