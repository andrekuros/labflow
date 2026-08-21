import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewArticle } from "@/lib/knowledge-access";
import { getVaultConnection } from "@/lib/knowledge/vault";
import { getFileBytes } from "@/plugins/knowledge/nextcloud-client";
import { mimeFromFileName } from "@/lib/knowledge/files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Nao autenticado", { status: 401 });

  const { id } = await params;
  const article = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!article || !(await canViewArticle(session, article))) {
    return new Response("Nao encontrado", { status: 404 });
  }
  if (article.kind !== "file" || !article.externalPath) {
    return new Response("Nao e um arquivo do vault", { status: 400 });
  }

  const conn = await getVaultConnection();
  if (!conn) return new Response("Nextcloud nao configurado", { status: 503 });

  try {
    const bytes = await getFileBytes(conn, article.externalPath);
    const mime = article.mimeType || mimeFromFileName(article.fileName || article.externalPath);
    const filename = article.fileName || article.externalPath.split("/").pop() || "arquivo";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao ler o arquivo";
    return new Response(message, { status: 502 });
  }
}
