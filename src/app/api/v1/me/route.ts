import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { authenticateApiRequest } from "@/plugins/api-auth";
import { jsonError, jsonOk } from "@/plugins/api-utils";
import { corsPreflight, withCors } from "@/plugins/api-cors";
import { runWithApiUser } from "@/lib/request-user";
import { listPermissionKeysForUser } from "@/lib/rbac";
import { visibleNavItems } from "@/lib/nav-visibility";
import { parsePreferences } from "@/lib/user-preferences";
import { resolveWorkspaceScope } from "@/lib/workspace";

/**
 * GET /api/v1/me — identity, effective permissions, nav and workspace scope.
 *
 * An external UI needs this on boot: it cannot read the RBAC tables, so without
 * the permission list it would have to guess which buttons to render and would
 * discover the answer only from 403s.
 */
export async function GET(request: NextRequest) {
  await bootstrapAsync();

  const user = await authenticateApiRequest(request);
  if (!user) return withCors(jsonError("Nao autenticado", 401), request);

  return runWithApiUser(user, async () => {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarColor: true, accountStatus: true, createdAt: true, preferences: true },
    });
    const [permissions, nav, scope] = await Promise.all([
      listPermissionKeysForUser(user),
      // Same filters the web sidebar applies, so an external UI does not render
      // entries the user cannot reach.
      visibleNavItems(user, parsePreferences(row?.preferences)),
      resolveWorkspaceScope(user),
    ]);

    return withCors(
      jsonOk({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profiles: user.profiles,
        avatarColor: row?.avatarColor ?? null,
        accountStatus: row?.accountStatus ?? "active",
        memberSince: row?.createdAt?.toISOString() ?? null,
        permissions,
        nav,
        workspace: {
          label: scope.label,
          focused: scope.focused,
          mode: scope.mode,
          kinds: scope.kinds ?? null,
          projectIds: scope.projectIds,
          visibleProjectCount: scope.visibleCount,
        },
      }),
      request,
    );
  });
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}
