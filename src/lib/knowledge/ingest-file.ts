import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { extractLibraryFile } from "@/lib/knowledge/extract";
import { articleIngestText, kindFromFileName, mimeFromFileName, LIBRARY_FILE_RE, LIBRARY_FORMATS_LABEL, titleFromFileName } from "@/lib/knowledge/files";
import { uniqueVaultPath, writeVaultBytes } from "@/lib/knowledge/vault";
import { parseFrontmatter } from "@/plugins/knowledge/frontmatter";
import { parentFolderFromPath } from "@/plugins/knowledge/folder-map";
import type { NextcloudConnection } from "@/plugins/knowledge/nextcloud-client";

export function sanitizeUploadFileName(name: string): string {
  return name.replace(/[/\\]/g, "_");
}

export function isAcceptedLibraryFile(name: string): boolean {
  return LIBRARY_FILE_RE.test(name);
}

/** Write a library file to the vault and create the KnowledgeArticle row. */
export async function ingestVaultFile(opts: {
  sessionId: string;
  fileName: string;
  bytes: Uint8Array;
  folder: string;
  projectId: string | null;
  conn: NextcloudConnection;
}): Promise<{ id: string; title: string } | { error: string }> {
  const name = sanitizeUploadFileName(opts.fileName);
  if (!isAcceptedLibraryFile(name)) {
    return { error: `Formatos aceitos: ${LIBRARY_FORMATS_LABEL}` };
  }

  const extracted = await extractLibraryFile(name, opts.bytes);
  const kind = kindFromFileName(name);
  const path = await uniqueVaultPath(opts.folder, name);
  const etag = await writeVaultBytes(
    opts.conn,
    path,
    opts.bytes,
    extracted.mimeType || mimeFromFileName(name),
  );

  let title = titleFromFileName(name);
  let content = "";
  let extractedText = extracted.text;
  let tags = ["nextcloud", ...parentFolderFromPath(path).split("/").filter(Boolean)].join(",");
  if (kind === "page") {
    const raw = new TextDecoder("utf-8").decode(opts.bytes);
    const { meta, body } = parseFrontmatter(raw);
    title = meta.title?.trim() || title;
    content = body.trim() ? body : raw;
    extractedText = body.trim();
    if (meta.tags?.length) tags = [...tags.split(","), ...meta.tags].join(",");
  }

  const a = await prisma.knowledgeArticle.create({
    data: {
      title,
      content,
      tags,
      projectId: opts.projectId,
      authorId: opts.sessionId,
      kind,
      mimeType: extracted.mimeType,
      fileName: name,
      byteSize: opts.bytes.byteLength,
      extractedText,
      externalSource: "nextcloud",
      externalPath: path,
      externalFolder: parentFolderFromPath(path) || null,
      externalEtag: etag,
      externalSyncedAt: new Date(),
    },
  });
  await emit({
    type: "article.created",
    actorId: opts.sessionId,
    projectId: a.projectId,
    targetId: a.id,
    payload: { id: a.id, title: a.title, content: articleIngestText(a) },
  });
  return { id: a.id, title: a.title };
}
