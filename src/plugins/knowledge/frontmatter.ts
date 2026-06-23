export type ArticleFrontmatter = {
  title?: string;
  tags?: string[];
  project?: string;
  projectId?: string;
  status?: string;
};

/** Minimal YAML frontmatter parser for common LabFlow fields. */
export function parseFrontmatter(content: string): { meta: ArticleFrontmatter; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const raw: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kv = trimmed.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    raw[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }

  const tags = raw.tags
    ? raw.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  return {
    meta: {
      title: raw.title,
      tags,
      project: raw.project ?? raw.projectkey,
      projectId: raw.projectid,
      status: raw.status,
    },
    body: match[2],
  };
}

export function stripFrontmatter(content: string): string {
  return parseFrontmatter(content).body;
}
