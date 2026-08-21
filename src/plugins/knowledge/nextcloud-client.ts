import "server-only";
import { LIBRARY_FILE_RE, PAGE_FILE_RE } from "@/lib/knowledge/files";

export type DavEntry = {
  path: string;
  name: string;
  isDirectory: boolean;
  etag: string;
  contentType: string;
};

export type NextcloudConnection = {
  url: string;
  username: string;
  password: string;
  folder: string;
};

function authHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

function normalizeFolder(folder: string) {
  return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function buildDavRoot(conn: NextcloudConnection): string {
  const folder = normalizeFolder(conn.folder);
  const user = encodeURIComponent(conn.username);
  return `${normalizeBase(conn.url)}/remote.php/dav/files/${user}/${folder.split("/").map(encodeURIComponent).join("/")}`;
}

function buildDavUrl(conn: NextcloudConnection, relativePath: string) {
  const root = buildDavRoot(conn);
  if (!relativePath) return root;
  const parts = relativePath.split("/").filter(Boolean).map(encodeURIComponent);
  return `${root}/${parts.join("/")}`;
}

function relativePathFromHref(href: string, conn: NextcloudConnection): string {
  const decoded = decodeURIComponent(href);
  const marker = "/remote.php/dav/files/";
  const idx = decoded.indexOf(marker);
  if (idx === -1) return "";
  const rest = decoded.slice(idx + marker.length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  parts.shift(); // username
  const folderParts = normalizeFolder(conn.folder).split("/").filter(Boolean);
  for (const fp of folderParts) {
    if (parts[0] === fp) parts.shift();
    else break;
  }
  return parts.join("/");
}

function parsePropfind(xml: string, conn: NextcloudConnection): DavEntry[] {
  const entries: DavEntry[] = [];
  const responses = xml.match(/<(?:d:)?response[\s\S]*?<\/(?:d:)?response>/gi) ?? [];

  for (const block of responses) {
    const hrefMatch = block.match(/<(?:d:)?href>([^<]+)<\/(?:d:)?href>/i);
    if (!hrefMatch) continue;

    const relative = relativePathFromHref(hrefMatch[1], conn);
    const isCollection = /<(?:d:)?collection\s*\/>/i.test(block);
    const etagMatch = block.match(/<(?:d:)?getetag>([^<]*)<\/(?:d:)?getetag>/i);
    const typeMatch = block.match(/<(?:d:)?getcontenttype>([^<]*)<\/(?:d:)?getcontenttype>/i);
    const name = relative.split("/").pop() ?? "";

    if (!relative && !isCollection) continue;

    entries.push({
      path: relative,
      name,
      isDirectory: isCollection,
      etag: (etagMatch?.[1] ?? "").replace(/"/g, ""),
      contentType: typeMatch?.[1] ?? "",
    });
  }

  return entries;
}

export async function propfind(
  conn: NextcloudConnection,
  relativePath = "",
  depth: number | "infinity" = 1,
): Promise<DavEntry[]> {
  const url = buildDavUrl(conn, relativePath);
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getetag/>
    <d:getcontenttype/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(conn.username, conn.password),
      Depth: String(depth),
      "Content-Type": "application/xml",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Nextcloud PROPFIND falhou (${res.status}): ${await res.text().catch(() => "")}`);
  }

  const xml = await res.text();
  return parsePropfind(xml, conn);
}

export async function getFileBytes(conn: NextcloudConnection, relativePath: string): Promise<Buffer> {
  const url = buildDavUrl(conn, relativePath);
  const res = await fetch(url, {
    headers: { Authorization: authHeader(conn.username, conn.password) },
  });
  if (!res.ok) {
    throw new Error(`Nextcloud GET falhou (${res.status}) para ${relativePath}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function getFile(conn: NextcloudConnection, relativePath: string): Promise<string> {
  const bytes = await getFileBytes(conn, relativePath);
  return bytes.toString("utf8");
}

export async function listMarkdownFiles(conn: NextcloudConnection): Promise<DavEntry[]> {
  const entries = await propfind(conn, "", "infinity");
  return entries.filter((e) => !e.isDirectory && PAGE_FILE_RE.test(e.name));
}

export async function listLibraryFiles(conn: NextcloudConnection): Promise<DavEntry[]> {
  const entries = await propfind(conn, "", "infinity");
  return entries.filter((e) => !e.isDirectory && LIBRARY_FILE_RE.test(e.name));
}

export async function listAllEntries(conn: NextcloudConnection): Promise<DavEntry[]> {
  return propfind(conn, "", "infinity");
}

export async function putFile(conn: NextcloudConnection, relativePath: string, content: string): Promise<string | null> {
  return putFileBytes(conn, relativePath, Buffer.from(content, "utf8"), "text/markdown; charset=utf-8");
}

export async function putFileBytes(
  conn: NextcloudConnection,
  relativePath: string,
  body: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const url = buildDavUrl(conn, relativePath);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authHeader(conn.username, conn.password),
      "Content-Type": contentType,
    },
    body: Buffer.from(body),
  });
  if (!res.ok) {
    throw new Error(`Nextcloud PUT falhou (${res.status}) para ${relativePath}`);
  }
  return res.headers.get("etag")?.replace(/"/g, "") ?? null;
}

export async function mkcol(conn: NextcloudConnection, relativePath: string): Promise<void> {
  const url = buildDavUrl(conn, relativePath);
  const res = await fetch(url, {
    method: "MKCOL",
    headers: { Authorization: authHeader(conn.username, conn.password) },
  });
  if (!res.ok && res.status !== 405) {
    throw new Error(`Nextcloud MKCOL falhou (${res.status}) para ${relativePath}`);
  }
}

export async function ensurePath(conn: NextcloudConnection, relativePath: string): Promise<void> {
  const parts = relativePath.split("/").filter(Boolean);
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    await mkcol(conn, acc);
  }
}

export async function fileExists(conn: NextcloudConnection, relativePath: string): Promise<boolean> {
  const url = buildDavUrl(conn, relativePath);
  const res = await fetch(url, {
    method: "HEAD",
    headers: { Authorization: authHeader(conn.username, conn.password) },
  });
  if (res.ok) return true;
  if (res.status === 404 || res.status === 405) {
    if (res.status === 405) {
      const get = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader(conn.username, conn.password) },
      });
      return get.ok;
    }
    return false;
  }
  const get = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader(conn.username, conn.password) },
  });
  return get.ok;
}

export async function testNextcloudConnection(conn: NextcloudConnection): Promise<{ ok: boolean; message: string }> {
  try {
    await propfind(conn, "", 0);
    return { ok: true, message: "Conexao OK" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Falha na conexao" };
  }
}
