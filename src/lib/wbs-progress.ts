export type WbsNodeInput = {
  id: string;
  parentId: string | null;
};

export type TaskProgressInput = {
  id: string;
  workPackageId: string | null;
  status: string;
  estimate: number | null;
};

export type WbsProgressMetrics = {
  totalTasks: number;
  doneTasks: number;
  totalWeight: number;
  doneWeight: number;
  progressPct: number;
  derivedStatus: "planned" | "in_progress" | "done";
};

export type ProjectProgressMetrics = WbsProgressMetrics & {
  unmappedTasks: number;
};

function taskWeight(estimate: number | null): number {
  return estimate != null && estimate > 0 ? estimate : 1;
}

function computeMetrics(totalTasks: number, doneTasks: number, totalWeight: number, doneWeight: number): WbsProgressMetrics {
  let progressPct = 0;
  if (totalWeight > 0) {
    progressPct = Math.round((doneWeight / totalWeight) * 100);
  } else if (totalTasks > 0) {
    progressPct = Math.round((doneTasks / totalTasks) * 100);
  }

  let derivedStatus: WbsProgressMetrics["derivedStatus"] = "planned";
  if (totalTasks > 0 && progressPct >= 100) derivedStatus = "done";
  else if (totalTasks > 0 && progressPct > 0) derivedStatus = "in_progress";

  return { totalTasks, doneTasks, totalWeight, doneWeight, progressPct, derivedStatus };
}

function emptyMetrics(): WbsProgressMetrics {
  return { totalTasks: 0, doneTasks: 0, totalWeight: 0, doneWeight: 0, progressPct: 0, derivedStatus: "planned" };
}

/** Aggregate task metrics for a WBS node and all descendants. */
export function computeWbsProgressMap(
  nodes: WbsNodeInput[],
  tasks: TaskProgressInput[],
): Map<string, WbsProgressMetrics> {
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = childrenMap.get(node.parentId) ?? [];
    list.push(node.id);
    childrenMap.set(node.parentId, list);
  }

  const tasksByWbs = new Map<string, TaskProgressInput[]>();
  for (const task of tasks) {
    if (!task.workPackageId) continue;
    const list = tasksByWbs.get(task.workPackageId) ?? [];
    list.push(task);
    tasksByWbs.set(task.workPackageId, list);
  }

  const cache = new Map<string, WbsProgressMetrics>();

  function aggregate(nodeId: string): WbsProgressMetrics {
    const cached = cache.get(nodeId);
    if (cached) return cached;

    let totalTasks = 0;
    let doneTasks = 0;
    let totalWeight = 0;
    let doneWeight = 0;

    for (const task of tasksByWbs.get(nodeId) ?? []) {
      const w = taskWeight(task.estimate);
      totalTasks += 1;
      totalWeight += w;
      if (task.status === "done") {
        doneTasks += 1;
        doneWeight += w;
      }
    }

    for (const childId of childrenMap.get(nodeId) ?? []) {
      const child = aggregate(childId);
      totalTasks += child.totalTasks;
      doneTasks += child.doneTasks;
      totalWeight += child.totalWeight;
      doneWeight += child.doneWeight;
    }

    const metrics = computeMetrics(totalTasks, doneTasks, totalWeight, doneWeight);
    cache.set(nodeId, metrics);
    return metrics;
  }

  for (const node of nodes) {
    aggregate(node.id);
  }

  return cache;
}

export function computeProjectProgress(tasks: TaskProgressInput[]): ProjectProgressMetrics {
  let totalTasks = 0;
  let doneTasks = 0;
  let totalWeight = 0;
  let doneWeight = 0;
  let unmappedTasks = 0;

  for (const task of tasks) {
    if (!task.workPackageId) unmappedTasks += 1;
    const w = taskWeight(task.estimate);
    totalTasks += 1;
    totalWeight += w;
    if (task.status === "done") {
      doneTasks += 1;
      doneWeight += w;
    }
  }

  return { ...computeMetrics(totalTasks, doneTasks, totalWeight, doneWeight), unmappedTasks };
}

export function getWbsProgress(
  nodeId: string,
  nodes: WbsNodeInput[],
  tasks: TaskProgressInput[],
): WbsProgressMetrics {
  const map = computeWbsProgressMap(nodes, tasks);
  return map.get(nodeId) ?? emptyMetrics();
}
