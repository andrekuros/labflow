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
