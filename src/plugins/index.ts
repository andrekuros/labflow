import "server-only";
import { registerPlugin, registerApiHandlers } from "@/plugins/registry";
import { examplePlugin } from "@/plugins/example";

import { teamManifest } from "@/plugins/team/manifest";
import { handlers as teamApi } from "@/plugins/team/api";

import { sprintsManifest } from "@/plugins/sprints/manifest";
import { handlers as sprintsApi } from "@/plugins/sprints/api";

import { requirementsManifest } from "@/plugins/requirements/manifest";
import { handlers as requirementsApi } from "@/plugins/requirements/api";

import { deliverablesManifest } from "@/plugins/deliverables/manifest";
import { handlers as deliverablesApi } from "@/plugins/deliverables/api";

import { roadmapManifest } from "@/plugins/roadmap/manifest";
import { handlers as roadmapApi } from "@/plugins/roadmap/api";

import { knowledgeManifest } from "@/plugins/knowledge/manifest";
import { handlers as knowledgeApi } from "@/plugins/knowledge/api";

import { forumManifest } from "@/plugins/forum/manifest";
import { handlers as forumApi } from "@/plugins/forum/api";

import { projectsManifest } from "@/plugins/projects/manifest";
import { handlers as projectsApi } from "@/plugins/projects/api";

import { boardManifest } from "@/plugins/board/manifest";
import { handlers as boardApi } from "@/plugins/board/api";

import { assistantManifest } from "@/plugins/assistant/manifest";
import { handlers as assistantApi } from "@/plugins/assistant/api";

const BUILTIN_PLUGINS = [
  projectsManifest,
  boardManifest,
  sprintsManifest,
  roadmapManifest,
  deliverablesManifest,
  requirementsManifest,
  knowledgeManifest,
  forumManifest,
  assistantManifest,
  teamManifest,
  examplePlugin,
];

const API_REGISTRATIONS: [string, typeof teamApi][] = [
  ["team", teamApi],
  ["sprints", sprintsApi],
  ["requirements", requirementsApi],
  ["deliverables", deliverablesApi],
  ["roadmap", roadmapApi],
  ["knowledge", knowledgeApi],
  ["forum", forumApi],
  ["projects", projectsApi],
  ["board", boardApi],
  ["assistant", assistantApi],
];

let loaded = false;

export function registerBuiltinPlugins() {
  if (loaded) return;
  loaded = true;

  for (const manifest of BUILTIN_PLUGINS) {
    registerPlugin(manifest);
  }

  for (const [id, handlers] of API_REGISTRATIONS) {
    registerApiHandlers(id, handlers);
  }
}

export { BUILTIN_PLUGINS };
