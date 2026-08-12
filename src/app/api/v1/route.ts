import { NextRequest } from "next/server";
import { bootstrapAsync } from "@/server/bootstrap";
import { authenticateApiRequest } from "@/plugins/api-auth";
import { jsonError, jsonOk } from "@/plugins/api-utils";
import { listEnabledPlugins, listRegisteredApiRoutes } from "@/plugins/registry";
import { runWithApiUser } from "@/lib/request-user";

/** Authenticated catalog of all plugin REST routes: GET /api/v1 */
export async function GET(request: NextRequest) {
  await bootstrapAsync();

  const user = await authenticateApiRequest(request);
  if (!user) return jsonError("Nao autenticado", 401);

  return runWithApiUser(user, async () => {
    const routes = listRegisteredApiRoutes();
    const enabled = listEnabledPlugins();
    const byPlugin = new Map<
      string,
      { id: string; name: string; apiPrefix?: string; routes: { method: string; path: string; url: string }[] }
    >();

    for (const p of enabled) {
      if (!p.manifest.apiPrefix) continue;
      byPlugin.set(p.manifest.id, {
        id: p.manifest.id,
        name: p.manifest.name,
        apiPrefix: p.manifest.apiPrefix,
        routes: [],
      });
    }

    for (const r of routes) {
      let entry = byPlugin.get(r.pluginId);
      if (!entry) {
        entry = { id: r.pluginId, name: r.pluginId, apiPrefix: `/api/v1/${r.pluginId}`, routes: [] };
        byPlugin.set(r.pluginId, entry);
      }
      entry.routes.push({ method: r.method, path: r.path, url: r.url });
    }

    return jsonOk({
      baseUrl: "/api/v1",
      auth: "Authorization: Bearer lf_... (API key) or JWT Bearer; browser session cookie also works when logged in",
      docs: "In-app Knowledge article: LabFlow — API REST. Catalog also at GET /api/v1.",
      plugins: [...byPlugin.values()].sort((a, b) => a.id.localeCompare(b.id)),
    });
  });
}
