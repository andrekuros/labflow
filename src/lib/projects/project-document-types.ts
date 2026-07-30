import type { ConopsData } from "@/lib/artifacts/schema";

export type ProjectReportSections = {
  overview: boolean;
  conops: boolean;
  team: boolean;
  wbs: boolean;
  deliverables: boolean;
  requirements: boolean;
  milestones: boolean;
  tasks: boolean;
  sprints: boolean;
};

export type ProjectReportConfig = {
  sections: ProjectReportSections;
  includeTaskDescriptions: boolean;
  includeCompletedTasks: boolean;
  wbsIds: string[];
  deliverableIds: string[];
  requirementIds: string[];
  milestoneIds: string[];
  taskIds: string[];
};

export const DEFAULT_REPORT_SECTIONS: ProjectReportSections = {
  overview: true,
  conops: true,
  team: true,
  wbs: true,
  deliverables: true,
  requirements: true,
  milestones: true,
  tasks: true,
  sprints: false,
};

export function defaultReportConfig(): ProjectReportConfig {
  return {
    sections: { ...DEFAULT_REPORT_SECTIONS },
    includeTaskDescriptions: true,
    includeCompletedTasks: true,
    wbsIds: [],
    deliverableIds: [],
    requirementIds: [],
    milestoneIds: [],
    taskIds: [],
  };
}

export function normalizeReportConfig(config?: Partial<ProjectReportConfig> | null): ProjectReportConfig {
  const base = defaultReportConfig();
  if (!config) return base;
  return {
    includeTaskDescriptions: config.includeTaskDescriptions ?? base.includeTaskDescriptions,
    includeCompletedTasks: config.includeCompletedTasks ?? base.includeCompletedTasks,
    sections: { ...base.sections, ...(config.sections ?? {}) },
    wbsIds: config.wbsIds ?? base.wbsIds,
    deliverableIds: config.deliverableIds ?? base.deliverableIds,
    requirementIds: config.requirementIds ?? base.requirementIds,
    milestoneIds: config.milestoneIds ?? base.milestoneIds,
    taskIds: config.taskIds ?? base.taskIds,
  };
}

export type ProjectReportData = {
  project: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    status: string;
    color: string;
  };
  conops: ConopsData;
  members: { name: string; role: string; profilesLabel: string }[];
  workPackages: {
    id: string;
    parentId: string | null;
    code: string | null;
    name: string;
    description: string | null;
    status: string;
    order: number;
  }[];
  deliverables: {
    id: string;
    workPackageId: string | null;
    workPackageCode: string | null;
    name: string;
    description: string | null;
    acceptance: string | null;
    status: string;
    dueDate: string | null;
  }[];
  requirements: {
    id: string;
    code: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    kind: string;
  }[];
  milestones: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    date: string | null;
    gate: string | null;
  }[];
  tasks: {
    id: string;
    workPackageId: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    estimate: number | null;
    dueDate: string | null;
    assignees: string;
    sprintName: string | null;
  }[];
  sprints: {
    id: string;
    name: string;
    goal: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }[];
  knowledgeArticleId: string | null;
  knowledgeArticleTitle: string | null;
};
