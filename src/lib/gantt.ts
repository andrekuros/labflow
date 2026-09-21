import "server-only";
import { prisma } from "@/lib/db";
import type { GanttData, GanttRow, GanttUnplaced } from "@/lib/gantt-types";

/**
 * Builds the Gantt tree: project > work package > (task | sprint | milestone | deliverable).
 *
 * Two honesty rules the UI depends on:
 *  - A row whose dates come from its descendants is flagged `rolledUp`, because a
 *    work package has no dates of its own in this schema.
 *  - A task with only a due date gets an inferred start (its sprint's start when
 *    that fits, otherwise `inferredDurationDays` back from the due date) and is
 *    flagged `inferredStart` so the UI can hatch the bar. Work with no usable date
 *    at all is never invented onto the chart — it is reported in `unplaced` so
 *    nobody reads the chart as the whole plan.
 */

const DAY = 86400000;

function iso(d: Date): string {
  return d.toISOString();
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() - copy.getUTCDay());
  return copy;
}

function endOfWeek(d: Date): Date {
  const copy = startOfWeek(d);
  copy.setUTCDate(copy.getUTCDate() + 7);
  return copy;
}

type Span = { start: Date; end: Date } | null;

function mergeSpan(a: Span, b: Span): Span {
  if (!a) return b;
  if (!b) return a;
  return {
    start: a.start < b.start ? a.start : b.start,
    end: a.end > b.end ? a.end : b.end,
  };
}

export async function getGanttData(opts: {
  projectIds: string[];
  /** Hide rows already finished, so the chart shows the live plan. */
  includeDone?: boolean;
  /**
   * Bar length, in days, given to a task that has only a due date. 1 keeps the
   * chart strictly truthful (a stub at the deadline); a larger value makes the
   * chart readable when the team does not fill start dates. Always hatched.
   */
  inferredDurationDays?: number;
}): Promise<GanttData> {
  const ids = opts.projectIds;
  const includeDone = opts.includeDone !== false;
  const inferredDays = Math.max(1, Math.round(opts.inferredDurationDays ?? 1));
  const now = new Date();

  if (ids.length === 0) {
    return {
      range: { start: iso(startOfWeek(now)), end: iso(endOfWeek(now)) },
      today: iso(now),
      rows: [],
      projects: [],
      unplaced: [],
      counts: { placed: 0, unplaced: 0 },
    };
  }

  const inScope = { in: ids };
  const [projects, workPackages, tasks, sprints, milestones, deliverables] = await Promise.all([
    prisma.project.findMany({
      where: { id: inScope },
      select: { id: true, key: true, name: true, color: true, kind: true },
      orderBy: { name: "asc" },
    }),
    prisma.workPackage.findMany({
      where: { projectId: inScope },
      select: {
        id: true,
        projectId: true,
        parentId: true,
        code: true,
        name: true,
        status: true,
        order: true,
      },
      orderBy: [{ order: "asc" }, { code: "asc" }],
    }),
    prisma.task.findMany({
      where: { projectId: inScope },
      select: {
        id: true,
        projectId: true,
        workPackageId: true,
        sprintId: true,
        title: true,
        status: true,
        startDate: true,
        dueDate: true,
        order: true,
        assignees: { select: { name: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.sprint.findMany({
      where: { projectId: inScope },
      select: {
        id: true,
        projectId: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: [{ startDate: "asc" }],
    }),
    prisma.milestone.findMany({
      where: { projectId: inScope },
      select: { id: true, projectId: true, name: true, status: true, date: true, kind: true, gate: true },
      orderBy: [{ date: "asc" }],
    }),
    prisma.deliverable.findMany({
      where: { projectId: inScope },
      select: {
        id: true,
        projectId: true,
        workPackageId: true,
        name: true,
        status: true,
        dueDate: true,
      },
      orderBy: [{ dueDate: "asc" }],
    }),
  ]);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const sprintById = new Map(sprints.map((s) => [s.id, s]));

  const unplacedByProject = new Map<string, GanttUnplaced>();
  function markUnplaced(projectId: string, field: keyof Omit<GanttUnplaced, "projectId" | "projectKey">) {
    const proj = projectById.get(projectId);
    if (!proj) return;
    const cur =
      unplacedByProject.get(projectId) ??
      { projectId, projectKey: proj.key, tasks: 0, deliverables: 0, milestones: 0 };
    cur[field] += 1;
    unplacedByProject.set(projectId, cur);
  }

  // ---- leaf rows -----------------------------------------------------------
  type Draft = GanttRow & { _span: Span };
  const drafts: Draft[] = [];
  const spanByRowId = new Map<string, Span>();

  function draft(row: Omit<GanttRow, "childCount"> & { _span: Span }) {
    drafts.push({ ...row, childCount: 0 });
    spanByRowId.set(row.id, row._span);
  }

  for (const t of tasks) {
    if (!includeDone && t.status === "done") continue;
    const proj = projectById.get(t.projectId)!;
    const sprint = t.sprintId ? sprintById.get(t.sprintId) : null;

    let start = t.startDate;
    let end = t.dueDate;
    let inferredStart = false;

    if (!start && end) {
      // Prefer the sprint window when the due date falls inside it; otherwise
      // walk back the configured default so the bar is visible at all.
      if (sprint?.startDate && sprint.startDate < end) start = sprint.startDate;
      else start = new Date(end.getTime() - (inferredDays - 1) * DAY);
      inferredStart = true;
    }
    if (start && !end) end = start;

    if (!start || !end) {
      markUnplaced(t.projectId, "tasks");
      continue;
    }

    const span = { start, end: end > start ? end : new Date(start.getTime() + DAY) };
    draft({
      id: `task:${t.id}`,
      entityId: t.id,
      kind: "task",
      parentId: t.workPackageId ? `work_package:${t.workPackageId}` : `project:${t.projectId}`,
      depth: 0,
      label: t.title,
      code: null,
      projectId: t.projectId,
      projectKey: proj.key,
      color: proj.color,
      status: t.status,
      start: iso(span.start),
      end: iso(span.end),
      rolledUp: false,
      inferredStart,
      point: false,
      progressPct: t.status === "done" ? 100 : t.status === "review" ? 75 : t.status === "in_progress" ? 40 : 0,
      overdue: t.status !== "done" && Boolean(t.dueDate && t.dueDate < now),
      assignees: t.assignees.map((a) => a.name),
      href: `/board?project=${t.projectId}`,
      _span: span,
    });
  }

  for (const s of sprints) {
    if (!s.startDate || !s.endDate) continue;
    const proj = projectById.get(s.projectId)!;
    const span = { start: s.startDate, end: s.endDate };
    draft({
      id: `sprint:${s.id}`,
      entityId: s.id,
      kind: "sprint",
      parentId: `project:${s.projectId}`,
      depth: 0,
      label: s.name,
      code: null,
      projectId: s.projectId,
      projectKey: proj.key,
      color: "#0ea5e9",
      status: s.status,
      start: iso(span.start),
      end: iso(span.end),
      rolledUp: false,
      inferredStart: false,
      point: false,
      progressPct: s.status === "completed" ? 100 : s.status === "active" ? 50 : 0,
      overdue: s.status !== "completed" && s.endDate < now,
      assignees: [],
      href: `/planning?project=${s.projectId}&tab=sprints`,
      _span: span,
    });
  }

  for (const m of milestones) {
    if (!m.date) {
      markUnplaced(m.projectId, "milestones");
      continue;
    }
    const proj = projectById.get(m.projectId)!;
    const span = { start: m.date, end: m.date };
    draft({
      id: `milestone:${m.id}`,
      entityId: m.id,
      kind: "milestone",
      parentId: `project:${m.projectId}`,
      depth: 0,
      label: m.gate ? `${m.gate} — ${m.name}` : m.name,
      code: null,
      projectId: m.projectId,
      projectKey: proj.key,
      color: "#8b5cf6",
      status: m.status,
      start: iso(span.start),
      end: iso(span.end),
      rolledUp: false,
      inferredStart: false,
      point: true,
      progressPct: m.status === "reached" ? 100 : 0,
      overdue: m.status !== "reached" && m.date < now,
      assignees: [],
      href: `/planning?project=${m.projectId}&tab=roadmap`,
      _span: span,
    });
  }

  for (const d of deliverables) {
    if (!d.dueDate) {
      markUnplaced(d.projectId, "deliverables");
      continue;
    }
    const proj = projectById.get(d.projectId)!;
    const span = { start: d.dueDate, end: d.dueDate };
    draft({
      id: `deliverable:${d.id}`,
      entityId: d.id,
      kind: "deliverable",
      parentId: d.workPackageId ? `work_package:${d.workPackageId}` : `project:${d.projectId}`,
      depth: 0,
      label: d.name,
      code: null,
      projectId: d.projectId,
      projectKey: proj.key,
      color: "#f59e0b",
      status: d.status,
      start: iso(span.start),
      end: iso(span.end),
      rolledUp: false,
      inferredStart: false,
      point: true,
      progressPct: d.status === "accepted" ? 100 : d.status === "submitted" ? 70 : 0,
      overdue: !["accepted", "rejected"].includes(d.status) && d.dueDate < now,
      assignees: [],
      href: `/planning?project=${d.projectId}&tab=deliverables`,
      _span: span,
    });
  }

  // ---- work packages: dates rolled up from descendants ---------------------
  const wpChildren = new Map<string, string[]>();
  for (const wp of workPackages) {
    const parentKey = wp.parentId ? `work_package:${wp.parentId}` : `project:${wp.projectId}`;
    const list = wpChildren.get(parentKey) ?? [];
    list.push(`work_package:${wp.id}`);
    wpChildren.set(parentKey, list);
  }

  const leafByParent = new Map<string, Draft[]>();
  for (const d of drafts) {
    if (!d.parentId) continue;
    const list = leafByParent.get(d.parentId) ?? [];
    list.push(d);
    leafByParent.set(d.parentId, list);
  }

  const wpById = new Map(workPackages.map((wp) => [wp.id, wp]));
  const wpSpan = new Map<string, Span>();
  const wpProgress = new Map<string, { done: number; total: number }>();

  function resolveWp(wpId: string, seen = new Set<string>()): Span {
    const rowId = `work_package:${wpId}`;
    if (wpSpan.has(rowId)) return wpSpan.get(rowId)!;
    if (seen.has(wpId)) return null; // defensive: a cycle in parentId must not hang
    seen.add(wpId);

    let span: Span = null;
    let done = 0;
    let total = 0;

    for (const leaf of leafByParent.get(rowId) ?? []) {
      span = mergeSpan(span, leaf._span);
      if (leaf.kind === "task" || leaf.kind === "deliverable") {
        total += 1;
        if (leaf.progressPct === 100) done += 1;
      }
    }
    for (const childRowId of wpChildren.get(rowId) ?? []) {
      const childId = childRowId.slice("work_package:".length);
      span = mergeSpan(span, resolveWp(childId, seen));
      const cp = wpProgress.get(childRowId);
      if (cp) {
        done += cp.done;
        total += cp.total;
      }
    }

    wpSpan.set(rowId, span);
    wpProgress.set(rowId, { done, total });
    return span;
  }

  for (const wp of workPackages) resolveWp(wp.id);

  const wpRows: Draft[] = workPackages.map((wp) => {
    const rowId = `work_package:${wp.id}`;
    const span = wpSpan.get(rowId) ?? null;
    const prog = wpProgress.get(rowId) ?? { done: 0, total: 0 };
    const proj = projectById.get(wp.projectId)!;
    return {
      id: rowId,
      entityId: wp.id,
      kind: "work_package",
      parentId: wp.parentId ? `work_package:${wp.parentId}` : `project:${wp.projectId}`,
      depth: 0,
      label: wp.name,
      code: wp.code,
      projectId: wp.projectId,
      projectKey: proj.key,
      color: proj.color,
      status: wp.status,
      start: span ? iso(span.start) : null,
      end: span ? iso(span.end) : null,
      rolledUp: true,
      inferredStart: false,
      point: false,
      progressPct: prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
      overdue: false,
      assignees: [],
      childCount: 0,
      href: `/projects/${wp.projectId}?tab=wbs`,
      _span: span,
    };
  });

  // ---- project rows: rolled up from everything under them ------------------
  const allChildren = [...drafts, ...wpRows];
  const projectRows: Draft[] = projects.map((p) => {
    let span: Span = null;
    let done = 0;
    let total = 0;
    for (const c of allChildren) {
      if (c.projectId !== p.id) continue;
      if (c.kind === "work_package") continue; // already covered by its own leaves
      span = mergeSpan(span, c._span);
      if (c.kind === "task" || c.kind === "deliverable") {
        total += 1;
        if (c.progressPct === 100) done += 1;
      }
    }
    return {
      id: `project:${p.id}`,
      entityId: p.id,
      kind: "project",
      parentId: null,
      depth: 0,
      label: p.name,
      code: p.key,
      projectId: p.id,
      projectKey: p.key,
      color: p.color,
      status: "active",
      start: span ? iso(span.start) : null,
      end: span ? iso(span.end) : null,
      rolledUp: true,
      inferredStart: false,
      point: false,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
      overdue: allChildren.some((c) => c.projectId === p.id && c.overdue),
      assignees: [],
      childCount: 0,
      href: `/projects/${p.id}`,
      _span: span,
    };
  });

  // ---- flatten depth-first, parents before children -----------------------
  const byParent = new Map<string | null, Draft[]>();
  for (const row of [...projectRows, ...wpRows, ...drafts]) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }

  const KIND_ORDER: Record<string, number> = {
    work_package: 0,
    sprint: 1,
    milestone: 2,
    deliverable: 3,
    task: 4,
    project: 5,
  };

  function sortRows(list: Draft[]): Draft[] {
    return [...list].sort((a, b) => {
      const k = (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
      if (k !== 0) return k;
      if (a.code && b.code) return a.code.localeCompare(b.code, undefined, { numeric: true });
      const as = a.start ? Date.parse(a.start) : Number.MAX_SAFE_INTEGER;
      const bs = b.start ? Date.parse(b.start) : Number.MAX_SAFE_INTEGER;
      if (as !== bs) return as - bs;
      return a.label.localeCompare(b.label);
    });
  }

  const flat: GanttRow[] = [];
  function walk(parentId: string | null, depth: number, guard = new Set<string>()) {
    for (const row of sortRows(byParent.get(parentId) ?? [])) {
      if (guard.has(row.id)) continue;
      guard.add(row.id);
      const children = byParent.get(row.id) ?? [];
      const { _span, ...clean } = row;
      void _span;
      flat.push({ ...clean, depth, childCount: children.length });
      walk(row.id, depth + 1, guard);
    }
  }
  walk(null, 0);

  // ---- overall range ------------------------------------------------------
  let overall: Span = null;
  for (const r of flat) {
    if (!r.start || !r.end) continue;
    overall = mergeSpan(overall, { start: new Date(r.start), end: new Date(r.end) });
  }
  const rangeStart = startOfWeek(overall ? overall.start : new Date(now.getTime() - 30 * DAY));
  const rangeEnd = endOfWeek(overall ? overall.end : new Date(now.getTime() + 30 * DAY));

  const unplaced = [...unplacedByProject.values()].sort((a, b) =>
    a.projectKey.localeCompare(b.projectKey),
  );

  return {
    range: { start: iso(rangeStart), end: iso(rangeEnd) },
    today: iso(now),
    rows: flat,
    projects,
    unplaced,
    counts: {
      placed: flat.filter((r) => r.start && r.kind !== "project" && r.kind !== "work_package").length,
      unplaced: unplaced.reduce((s, u) => s + u.tasks + u.deliverables + u.milestones, 0),
    },
  };
}
