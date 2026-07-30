import "server-only";
import { createHash, randomBytes } from "crypto";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { getUserProfileKeys } from "@/lib/user-profiles";
import { legacyRoleToProfiles, primaryProfile } from "@/lib/profile-meta";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "insecure-dev-secret-change-me",
);

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const raw = `lf_${randomBytes(32).toString("hex")}`;
  return { raw, hash: hashApiKey(raw) };
}

export async function authenticateApiRequest(
  request: Request,
): Promise<SessionUser | null> {
  const auth = request.headers.get("authorization");
  if (!auth) return null;

  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token.startsWith("lf_")) {
      const hash = hashApiKey(token);
      const row = await prisma.apiKey.findUnique({
        where: { keyHash: hash },
        include: { user: true },
      });
      if (!row) return null;
      await prisma.apiKey.update({
        where: { id: row.id },
        data: { lastUsed: new Date() },
      });
      const profiles = await getUserProfileKeys(row.user.id);
      return {
        id: row.user.id,
        email: row.user.email,
        name: row.user.name,
        role: primaryProfile(profiles),
        profiles,
      };
    }

    try {
      const { payload } = await jwtVerify(token, secret);
      const profiles = Array.isArray(payload.profiles)
        ? (payload.profiles as string[])
        : legacyRoleToProfiles(payload.role as string);
      return {
        id: payload.id as string,
        email: payload.email as string,
        name: payload.name as string,
        role: primaryProfile(profiles),
        profiles,
      };
    } catch {
      return null;
    }
  }

  return null;
}
