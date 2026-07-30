import "server-only";

import { ensurePluginRegistry, getPluginSettings, getPluginProjectSettings } from "@/plugins/registry";
import { parseColumnIds, FALLBACK_COLUMN_IDS } from "@/lib/board-columns";

function globalDefaultColumnIds(): string[] {
  const settings = getPluginSettings("board");
  return parseColumnIds(settings.columns) ?? [...FALLBACK_COLUMN_IDS];
}

export async function getBoardColumnsForProject(projectId: string): Promise<string[]> {
  await ensurePluginRegistry();
  const override = await getPluginProjectSettings("board", projectId);
  const projectCols = parseColumnIds(override.columns);
  if (projectCols) return projectCols;
  return globalDefaultColumnIds();
}

export async function getBoardColumnsMap(projectIds: string[]): Promise<Record<string, string[]>> {
  if (projectIds.length === 0) return {};
  const entries = await Promise.all(
    projectIds.map(async (id) => [id, await getBoardColumnsForProject(id)] as const),
  );
  return Object.fromEntries(entries);
}
