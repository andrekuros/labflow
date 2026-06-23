export type FolderTreeNode = {
  path: string;
  name: string;
  children: FolderTreeNode[];
  articleCount: number;
  totalCount: number;
};

type ArticleFolderRef = {
  externalFolder: string | null;
  externalSource: string | null;
};

function insertNode(root: FolderTreeNode[], parts: string[], leafCount: number) {
  if (parts.length === 0) return;
  const [head, ...rest] = parts;
  const path = parts.join("/");
  let node = root.find((n) => n.name === head);
  if (!node) {
    node = { path, name: head, children: [], articleCount: 0, totalCount: 0 };
    root.push(node);
  }
  if (rest.length === 0) node.articleCount += leafCount;
  else insertNode(node.children, rest, leafCount);
}

function rollupCounts(nodes: FolderTreeNode[]): number {
  let total = 0;
  for (const n of nodes) {
    n.totalCount = n.articleCount + rollupCounts(n.children);
    total += n.totalCount;
  }
  return total;
}

function sortTree(nodes: FolderTreeNode[]) {
  nodes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  for (const n of nodes) sortTree(n.children);
}

/** Build navigable folder tree from synced article paths. */
export function buildFolderTree(articles: ArticleFolderRef[]): {
  nextcloud: FolderTreeNode[];
  localCount: number;
  totalCount: number;
} {
  const nextcloudRoots: FolderTreeNode[] = [];
  let localCount = 0;

  for (const a of articles) {
    if (a.externalSource === "nextcloud") {
      const folder = (a.externalFolder ?? "").replace(/^\/+|\/+$/g, "");
      if (!folder) {
        const root = nextcloudRoots.find((n) => n.name === "(raiz)");
        if (root) root.articleCount += 1;
        else nextcloudRoots.push({ path: "", name: "(raiz)", children: [], articleCount: 1, totalCount: 1 });
      } else {
        insertNode(nextcloudRoots, folder.split("/"), 1);
      }
    } else {
      localCount += 1;
    }
  }

  rollupCounts(nextcloudRoots);
  sortTree(nextcloudRoots);

  const ncTotal = nextcloudRoots.reduce((s, n) => s + n.totalCount, 0);
  return { nextcloud: nextcloudRoots, localCount, totalCount: ncTotal + localCount };
}

export function articleMatchesFolder(
  article: { externalFolder: string | null; externalSource: string | null },
  selected: string | null,
): boolean {
  if (!selected || selected === "all") return true;
  if (selected === "_local") return article.externalSource !== "nextcloud";
  const folder = (article.externalFolder ?? "").replace(/^\/+|\/+$/g, "");
  return folder === selected || folder.startsWith(`${selected}/`);
}
