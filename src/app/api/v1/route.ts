import { NextRequest } from "next/server";
import { bootstrapAsync } from "@/server/bootstrap";
import { authenticateApiRequest } from "@/plugins/api-auth";
import { jsonError, jsonOk } from "@/plugins/api-utils";
import { listEnabledPlugins, listRegisteredApiRoutes } from "@/plugins/registry";
import { runWithApiUser } from "@/lib/request-user";
import { corsPreflight, corsOrigins, withCors } from "@/plugins/api-cors";

/** Authenticated catalog of all plugin REST routes: GET /api/v1 */
export async function GET(request: NextRequest) {
  await bootstrapAsync();

  const user = await authenticateApiRequest(request);
  if (!user) return withCors(jsonError("Nao autenticado", 401), request);

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

    return withCors(
      jsonOk({
        baseUrl: "/api/v1",
        auth: {
          schemes: [
            "Authorization: Bearer lf_...  (API key, Settings > API)",
            "Authorization: Bearer <JWT>   (POST /api/v1/auth/token)",
            "Cookie labflow_session        (same-origin browser calls)",
          ],
          tokenEndpoint: "/api/v1/auth/token",
          whoami: "/api/v1/me",
        },
        openapi: "/api/v1/openapi.json",
        envelope: {
          success: "{ ok: true, data: ... }",
          error: "{ ok: false, error: string }",
          note: "File downloads return raw bytes, not an envelope.",
        },
        pagination: {
          request: "?page=1&pageSize=20",
          response: "{ total, page, pageSize } alongside the rows",
          note: "Endpoints without these fields return the full collection.",
        },
        cors: {
          configuredOrigins: corsOrigins(),
          envVar: "API_CORS_ORIGINS",
          note:
            corsOrigins().length === 0
              ? "Nenhuma origem externa liberada: defina API_CORS_ORIGINS para usar uma UI em outro dominio."
              : undefined,
        },
        docs: "In-app Knowledge article: LabFlow — API REST. Catalog also at GET /api/v1.",
        plugins: [...byPlugin.values()].sort((a, b) => a.id.localeCompare(b.id)),
      }),
      request,
    );
  });
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}
