import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

function statusForMessage(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("nao autenticado") || lower.includes("não autenticado")) return 401;
  if (lower.includes("sem permissao") || lower.includes("sem permissão") || lower.includes("permissao")) {
    return 403;
  }
  if (lower.includes("nao encontrado") || lower.includes("não encontrado")) return 404;
  return 400;
}

/**
 * Run an action/handler body and map thrown errors or `{ error }` results to JSON responses.
 */
export async function runApiAction<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "error" in result) {
      const err = (result as { error?: unknown }).error;
      if (typeof err === "string" && err) return jsonError(err, statusForMessage(err));
    }
    return jsonOk(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return jsonError(message, statusForMessage(message));
  }
}
