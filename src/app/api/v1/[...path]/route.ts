import { NextRequest } from "next/server";
import { bootstrapAsync } from "@/server/bootstrap";
import { authenticateApiRequest } from "@/plugins/api-auth";
import { jsonError, readJsonBody } from "@/plugins/api-utils";
import { matchApiHandler, getPlugin } from "@/plugins/registry";
import { runWithApiUser } from "@/lib/request-user";
import { corsPreflight, withCors } from "@/plugins/api-cors";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
  await bootstrapAsync();

  const user = await authenticateApiRequest(request);
  if (!user) return withCors(jsonError("Nao autenticado", 401), request);

  return runWithApiUser(user, async () => {
    const { path } = await context.params;
    if (!path?.length) return withCors(jsonError("Rota invalida", 404), request);

    const pluginId = path[0];
    const subPath = path.slice(1).join("/");

    const plugin = getPlugin(pluginId);
    if (!plugin || !plugin.enabled) {
      return withCors(jsonError("Plugin nao encontrado ou desativado", 404), request);
    }

    const match = matchApiHandler(pluginId, request.method, subPath);
    if (!match) return withCors(jsonError("Endpoint nao encontrado", 404), request);

    const body = await readJsonBody(request);
    const response = await match.handler({ user, params: match.params, request }, body);
    return withCors(response, request);
  });
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}
