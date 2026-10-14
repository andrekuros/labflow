import { NextRequest } from "next/server";
import { bootstrapAsync } from "@/server/bootstrap";
import { authenticateApiRequest } from "@/plugins/api-auth";
import { jsonError } from "@/plugins/api-utils";
import { listEnabledPlugins, listRegisteredApiRoutes } from "@/plugins/registry";
import { corsPreflight, withCors } from "@/plugins/api-cors";
import { runWithApiUser } from "@/lib/request-user";

/**
 * GET /api/v1/openapi.json — an OpenAPI 3.1 document generated from the live
 * plugin route registry.
 *
 * Honest about its limits: paths, methods and path parameters are real, taken
 * from the registered handlers, but request/response bodies are described
 * generically (the envelope plus a free-form `data`) because handlers do not
 * declare schemas. It is enough to generate a typed client's surface and to
 * drive tools like Swagger UI; it is not a substitute for reading the handler
 * when you need the exact shape of `data`.
 */

type OpenApiOperation = {
  operationId: string;
  summary: string;
  tags: string[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
};

const ENVELOPE_OK = {
  description: "Sucesso",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["ok", "data"],
        properties: { ok: { const: true }, data: {} },
      },
    },
  },
};

const ENVELOPE_ERROR = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["ok", "error"],
        properties: { ok: { const: false }, error: { type: "string" } },
      },
    },
  },
});

function toOperationId(method: string, pluginId: string, path: string): string {
  const parts = [method.toLowerCase(), pluginId, ...path.split("/")]
    .filter(Boolean)
    .map((p) => p.replace(/^:/, "by-").replace(/[^a-zA-Z0-9]+/g, "-"));
  return parts
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** `items/:id` -> `items/{id}` plus the matching parameter objects. */
function convertPath(url: string): { path: string; params: unknown[] } {
  const params: unknown[] = [];
  const path = url.replace(/:([^/]+)/g, (_, name: string) => {
    params.push({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
      description: `Identificador (${name})`,
    });
    return `{${name}}`;
  });
  return { path, params };
}

export async function GET(request: NextRequest) {
  await bootstrapAsync();

  const user = await authenticateApiRequest(request);
  if (!user) return withCors(jsonError("Nao autenticado", 401), request);

  return runWithApiUser(user, async () => {
    const routes = listRegisteredApiRoutes();
    const enabled = new Map(listEnabledPlugins().map((p) => [p.manifest.id, p.manifest]));

    const paths: Record<string, Record<string, OpenApiOperation>> = {};
    const tags = new Set<string>();

    for (const route of routes) {
      const manifest = enabled.get(route.pluginId);
      if (!manifest) continue; // disabled plugins answer 404; do not advertise them
      tags.add(route.pluginId);

      const { path, params } = convertPath(route.url);
      const method = route.method.toLowerCase();
      const isWrite = ["post", "patch", "put"].includes(method);
      const isUpload = /\/files$/.test(route.url) && method === "post";

      paths[path] = paths[path] ?? {};
      paths[path][method] = {
        operationId: toOperationId(route.method, route.pluginId, route.path),
        summary: `${manifest.name}: ${route.method} ${route.path || "/"}`,
        tags: [route.pluginId],
        ...(params.length ? { parameters: params } : {}),
        ...(isWrite
          ? {
              requestBody: {
                required: false,
                content: isUpload
                  ? {
                      "multipart/form-data": {
                        schema: {
                          type: "object",
                          properties: {
                            file: {
                              type: "array",
                              items: { type: "string", format: "binary" },
                              description: "Um ou mais arquivos (campo repetivel)",
                            },
                            bundle: { type: "string" },
                          },
                        },
                      },
                    }
                  : { "application/json": { schema: { type: "object", additionalProperties: true } } },
              },
            }
          : {}),
        responses: {
          "200": ENVELOPE_OK,
          "400": ENVELOPE_ERROR("Requisicao invalida"),
          "401": ENVELOPE_ERROR("Nao autenticado"),
          "403": ENVELOPE_ERROR("Sem permissao"),
          "404": ENVELOPE_ERROR("Nao encontrado ou plugin desativado"),
        },
      };
    }

    // Hand-written routes that live outside the plugin registry.
    paths["/api/v1/auth/token"] = {
      post: {
        operationId: "authToken",
        summary: "Troca email e senha por um bearer token JWT",
        tags: ["auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                  ttlHours: { type: "number", description: "Validade desejada (max 720h)" },
                },
              },
            },
          },
        },
        responses: { "200": ENVELOPE_OK, "401": ENVELOPE_ERROR("Credenciais invalidas") },
      },
    };
    paths["/api/v1/me"] = {
      get: {
        operationId: "me",
        summary: "Identidade, permissoes efetivas, nav e contexto de trabalho",
        tags: ["auth"],
        responses: { "200": ENVELOPE_OK, "401": ENVELOPE_ERROR("Nao autenticado") },
      },
    };
    paths["/api/v1"] = {
      get: {
        operationId: "catalog",
        summary: "Catalogo de rotas, autenticacao e convencoes",
        tags: ["meta"],
        responses: { "200": ENVELOPE_OK },
      },
    };
    tags.add("auth");
    tags.add("meta");

    const origin = new URL(request.url).origin;

    return withCors(
      Response.json({
        openapi: "3.1.0",
        info: {
          title: "LabFlow API",
          version: "1.0.0",
          description:
            "API REST dos plugins do LabFlow. Toda resposta JSON usa o envelope " +
            "`{ ok, data }` ou `{ ok, error }`; downloads de arquivo retornam bytes crus. " +
            "Os corpos de requisicao e resposta estao descritos de forma generica: " +
            "os handlers nao declaram schemas, portanto o campo `data` e livre. " +
            "Permissoes sao as mesmas da interface — consulte GET /api/v1/me.",
        },
        servers: [{ url: origin }],
        tags: [...tags].sort().map((name) => ({ name })),
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT ou chave lf_...",
              description:
                "Use POST /api/v1/auth/token para obter um JWT, ou gere uma chave `lf_...` " +
                "em Configuracoes > API.",
            },
            cookieAuth: {
              type: "apiKey",
              in: "cookie",
              name: "labflow_session",
              description: "Sessao do navegador — funciona apenas em chamadas same-origin.",
            },
          },
        },
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        paths,
      }),
      request,
    );
  });
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}
