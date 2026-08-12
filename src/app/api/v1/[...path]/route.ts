import { NextRequest } from "next/server";
import { bootstrapAsync } from "@/server/bootstrap";
import { authenticateApiRequest } from "@/plugins/api-auth";
import { jsonError, readJsonBody } from "@/plugins/api-utils";
import { matchApiHandler, getPlugin } from "@/plugins/registry";
import { runWithApiUser } from "@/lib/request-user";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
  await bootstrapAsync();

  const user = await authenticateApiRequest(request);
  if (!user) return jsonError("Nao autenticado", 401);

  return runWithApiUser(user, async () => {
    const { path } = await context.params;
    if (!path?.length) return jsonError("Rota invalida", 404);

    const pluginId = path[0];
    const subPath = path.slice(1).join("/");

    const plugin = getPlugin(pluginId);
    if (!plugin || !plugin.enabled) return jsonError("Plugin nao encontrado ou desativado", 404);

    const match = matchApiHandler(pluginId, request.method, subPath);
    if (!match) return jsonError("Endpoint nao encontrado", 404);

    const body = await readJsonBody(request);
    return match.handler({ user, params: match.params, request }, body);
  });
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
