"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { formatActivityRow, type ActivityLogRow } from "@/lib/activity-log/format";
import { labelForEvent } from "@/lib/activity-log/constants";
import type { Prisma } from "@prisma/client";

export type ActivityLogQuery = {
  from: string;
  to: string;
  actorId?: string;
  projectId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
};

export type ActivityLogResult = {
  entries: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
  todayCount: number;
  typeCounts: { type: string; label: string; count: number }[];
};

function buildWhere(query: ActivityLogQuery): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {
    createdAt: {
      gte: new Date(query.from),
      lte: new Date(`${query.to}T23:59:59.999`),
    },
  };
  if (query.actorId) where.actorId = query.actorId;
  if (query.projectId) where.projectId = query.projectId;
  if (query.type) where.type = query.type;
  return where;
}

export async function queryActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult> {
  await requirePermission("activity_log:view");

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 50));
  const where = buildWhere(query);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [rows, total, todayCount, grouped] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.activityLog.groupBy({
      by: ["type"],
      where,
      _count: true,
      orderBy: { _count: { type: "desc" } },
    }),
  ]);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean) as string[])];
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean) as string[])];

  const [actors, projects] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, avatarColor: true },
        })
      : [],
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, key: true, name: true, color: true },
        })
      : [],
  ]);

  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return {
    entries: rows.map((row) =>
      formatActivityRow({
        ...row,
        actor: row.actorId ? actorMap.get(row.actorId) ?? null : null,
        project: row.projectId ? projectMap.get(row.projectId) ?? null : null,
      }),
    ),
    total,
    page,
    pageSize,
    todayCount,
    typeCounts: grouped.map((g) => ({
      type: g.type,
      label: labelForEvent(g.type),
      count: g._count,
    })),
  };
}

export async function listActivityFilterOptions() {
  await requirePermission("activity_log:view");

  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      where: { accountStatus: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { users, projects };
}
