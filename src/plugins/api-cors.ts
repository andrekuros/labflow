import "server-only";

/**
 * CORS for /api/v1, so a separately hosted UI can call this API.
 *
 * Origins come from `API_CORS_ORIGINS` (comma-separated). Nothing is allowed by
 * default: an API that answers every origin with credentials enabled is a CSRF
 * hole, since this API also accepts the browser session cookie.
 *
 * `API_CORS_ORIGINS=*` allows any origin but then credentials are refused
 * (`Access-Control-Allow-Credentials` is omitted and the echo is `*`), which is
 * the only combination the fetch spec permits. Token-based callers still work.
 */

const ALLOWED_HEADERS = "Authorization, Content-Type, X-Requested-With";
const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const MAX_AGE = "86400";

export function corsOrigins(): string[] {
  const raw = process.env.API_CORS_ORIGINS ?? "";
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function corsAllowsAnyOrigin(): boolean {
  return corsOrigins().includes("*");
}

/** Headers to add to a response for this request's Origin, or `{}` when not allowed. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};

  const allowed = corsOrigins();
  if (allowed.length === 0) return {};

  if (allowed.includes("*")) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Disposition, X-Checksum-Sha256",
      Vary: "Origin",
    };
  }

  const normalized = origin.replace(/\/+$/, "");
  if (!allowed.includes(normalized)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Content-Disposition, X-Checksum-Sha256",
    Vary: "Origin",
  };
}

/** Apply CORS headers to an already-built response. */
export function withCors(response: Response, request: Request): Response {
  const headers = corsHeaders(request);
  if (Object.keys(headers).length === 0) return response;
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  return response;
}

/** Preflight answer. 204 when the origin is allowed, 403 when it is not. */
export function corsPreflight(request: Request): Response {
  const headers = corsHeaders(request);
  if (Object.keys(headers).length === 0) {
    return new Response(null, {
      status: 403,
      headers: { "X-Cors-Reason": "origin not allowed; set API_CORS_ORIGINS" },
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Max-Age": MAX_AGE,
    },
  });
}
