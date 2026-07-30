export const DATA_TRANSFER_VERSION = "1.0";

export type ProjectDataBundle = {
  version: typeof DATA_TRANSFER_VERSION;
  kind: "project";
  exportedAt: string;
  project: {
    key: string;
    name: string;
    description: string | null;
    color: string;
    status: string;
    conops: string;
    projectKind?: string;
    featuresJson?: string;
    academicJson?: string;
    paperJson?: string;
  };
  memberships: { email: string; role: string }[];
  labels: { name: string; color: string }[];
  sprints: {
    _ref: string;
    name: string;
    goal: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
  }[];
  workPackages: {
    _ref: string;
    code: string | null;
    name: string;
    description: string | null;
    status: string;
    order: number;
    parentRef: string | null;
  }[];
  requirements: {
    _ref: string;
    code: string | null;
    title: string;
    description: string | null;
    level: string;
    source: string | null;
    kind: string;
    priority: string;
    status: string;
    parentRef: string | null;
    allocatedToRef: string | null;
    deliverableRefs: string[];
    activityRefs: string[];
  }[];
  deliverables: {
    _ref: string;
    name: string;
    description: string | null;
    acceptance: string | null;
    status: string;
    dueDate: string | null;
    workPackageRef: string | null;
  }[];
  systemElements: {
    _ref: string;
    name: string;
    description: string | null;
    kind: string;
    diagram: string | null;
    order: number;
    parentRef: string | null;
  }[];
  interfaces: {
    _ref: string;
    name: string;
    description: string | null;
    kind: string;
    protocol: string | null;
    fromRef: string;
    toRef: string;
  }[];
  milestones: {
    _ref: string;
    name: string;
    description: string | null;
    kind: string;
    gate: string | null;
    date: string | null;
    status: string;
  }[];
  verificationCases: {
    _ref: string;
    name: string;
    method: string;
    status: string;
    result: string | null;
    evidence: string | null;
    requirementRef: string;
    milestoneRef: string | null;
  }[];
  tasks: {
    _ref: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    estimate: number | null;
    startDate: string | null;
    dueDate: string | null;
    order: number;
    workPackageRef: string | null;
    sprintRef: string | null;
    creatorEmail: string | null;
    assigneeEmails: string[];
    labelNames: string[];
    comments: { authorEmail: string | null; content: string; createdAt: string }[];
  }[];
  aiDrafts: {
    artifactType: string;
    title: string;
    payload: string;
    source: string;
    status: string;
  }[];
  knowledgeArticles: {
    _ref: string;
    title: string;
    content: string;
    tags: string;
    externalSource: string | null;
    externalPath: string | null;
    externalFolder: string | null;
    externalEtag: string | null;
    externalStatus: string | null;
    externalSyncedAt: string | null;
    authorEmail: string | null;
    links: { targetType: string; targetRef: string }[];
  }[];
  pluginSettings: { pluginId: string; settings: string }[];
  channels: {
    _ref: string;
    name: string;
    description: string | null;
    threads: {
      _ref: string;
      title: string;
      status: string;
      pinned: boolean;
      authorEmail: string | null;
      posts: { authorEmail: string | null; content: string; createdAt: string }[];
    }[];
  }[];
  /** @deprecated Publication entity removed; papers are projects (kind=paper). */
  publications?: {
    _ref: string;
    title: string;
    abstract: string;
    venue: string | null;
    venueType: string | null;
    status: string;
    targetDate: string | null;
    publishedAt: string | null;
    doi: string | null;
    externalEditorUrl: string | null;
    motivation: string;
    objective: string;
    problemStatement: string;
    hypothesis: string;
    methodology: string;
    theoreticalFramework: string;
    academicContribution: string;
    expectedResults: string;
    limitations: string;
    notes: string;
    aiReviewsJson: string;
    aiReportJson: string;
    leadAuthorEmail: string | null;
    authors: { email: string; role: string; authorOrder: number }[];
    links: { targetType: string; targetRef: string; label: string | null }[];
  }[];
  feedbacks: {
    title: string;
    description: string;
    category: string;
    status: string;
    platformUrl: string | null;
    submittedByEmail: string;
    assigneeEmail: string | null;
    linkedDrafts: string;
  }[];
};

export type UserDataBundle = {
  version: typeof DATA_TRANSFER_VERSION;
  kind: "user";
  exportedAt: string;
  user: {
    email: string;
    name: string;
    passwordHash: string;
    role: string;
    accountStatus: string;
    avatarColor: string;
    preferences: string;
    approvedAt: string | null;
    approvedBy: string | null;
  };
  profiles: string[];
  academicProfile: {
    program: string;
    status: string;
    motivation: string;
    objective: string;
    problemStatement: string;
    hypothesis: string;
    methodology: string;
    academicContribution: string;
    expectedResults: string;
    limitations: string;
    theoreticalFramework: string;
    advisorName: string | null;
    coAdvisorName: string | null;
    startDate: string | null;
    expectedDefenseDate: string | null;
    coursesJson: string;
    pendingJson: string;
    notes: string;
    aiReviewsJson: string;
    aiReportJson: string;
  } | null;
  memberships: { projectKey: string; role: string }[];
};

export type ProjectImportResult = {
  projectId: string;
  projectKey: string;
  created: Record<string, number>;
  warnings: string[];
};

export type UserImportResult = {
  userId: string;
  email: string;
  created: boolean;
  warnings: string[];
};
