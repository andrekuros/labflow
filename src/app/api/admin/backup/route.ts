import { getSession } from "@/lib/auth";
import { isAdminUser } from "@/lib/user-access";
import { createBackupArchive } from "@/lib/backup";

export async function GET() {
  const session = await getSession();
  if (!session || !isAdminUser(session)) {
    return new Response("Sem permissao", { status: 403 });
  }

  try {
    const archive = await createBackupArchive();
    const filename = `labflow-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(archive.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no backup";
    return new Response(message, { status: 500 });
  }
}
