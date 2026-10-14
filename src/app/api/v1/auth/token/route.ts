import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { buildSessionUser, verifyPassword } from "@/lib/auth";
import { canLogin } from "@/lib/user-access";
import { jsonError, jsonOk } from "@/plugins/api-utils";
import { corsPreflight, withCors } from "@/plugins/api-cors";

/**
 * POST /api/v1/auth/token  { email, password }  ->  { token, expiresAt, user }
 *
 * Lets an external UI exchange credentials for a bearer token, since the session
 * cookie is httpOnly and same-origin only. The token is the same JWT the cookie
 * carries, so it grants exactly the caller's own permissions — no more.
 *
 * A wrong email and a wrong password return the same message, and both paths run
 * a bcrypt comparison, so the response does not reveal which accounts exist.
 */

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "insecure-dev-secret-change-me",
);

/** Bcrypt hash of a random string: burned on unknown emails to equalise timing. */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const DEFAULT_TTL_HOURS = 12;
const MAX_TTL_HOURS = 24 * 30;

function ttlHours(requested: unknown): number {
  const fromEnv = Number(process.env.API_TOKEN_TTL_HOURS);
  const fallback = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TTL_HOURS;
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_TTL_HOURS);
}

export async function POST(request: NextRequest) {
  await bootstrapAsync();

  let body: { email?: string; password?: string; ttlHours?: number } | undefined;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return withCors(jsonError("Corpo JSON obrigatorio: { email, password }"), request);
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return withCors(jsonError("Campos email e password sao obrigatorios"), request);
  }

  const row = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok) {
    return withCors(jsonError("Credenciais invalidas", 401), request);
  }
  if (!canLogin(row.accountStatus)) {
    return withCors(jsonError("Conta pendente ou desativada", 403), request);
  }

  const user = await buildSessionUser(row);
  const hours = ttlHours(body?.ttlHours);
  const expiresAt = new Date(Date.now() + hours * 3600_000);

  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  return withCors(
    jsonOk({
      token,
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: hours * 3600,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, profiles: user.profiles },
      usage: "Authorization: Bearer <token>",
    }),
    request,
  );
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}
