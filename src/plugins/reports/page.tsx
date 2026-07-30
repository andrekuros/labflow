import { requireUser } from "@/lib/rbac";
import { canViewAllReports } from "@/lib/user-access";
import { prisma } from "@/lib/db";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";
import { EmptyState } from "@/components/ui";
import { ReportsClient } from "@/components/reports/reports-client";
import { getUserActivitySummary, getTeamOverview } from "@/plugins/reports/actions";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; from?: string; to?: string; view?: string }>;
}) {
  const session = await requireUser();
  await ensurePluginRegistry();
  const params = await searchParams;

  const isAdmin = canViewAllReports(session);
  const settings = getPluginSettings("reports");
  const periodDays = Number(settings.reportPeriodDays ?? 14);
  const includeAcademic = Boolean(settings.includeAcademic ?? true);

  const now = new Date();
  const from = params.from ? new Date(params.from) : new Date(now.getTime() - periodDays * 86400000);
  const to = params.to ? new Date(params.to) : now;

  const viewMode = params.view === "bi" && isAdmin ? "bi" : "report";
  const targetUserId = isAdmin && params.user ? params.user : session.id;

  const users = isAdmin
    ? (await prisma.user.findMany({
        where: { accountStatus: "active" },
        select: {
          id: true,
          name: true,
          role: true,
          avatarColor: true,
          profiles: { select: { profile: true } },
        },
        orderBy: { name: "asc" },
      })).map((u) => {
        const profiles = u.profiles.length
          ? normalizeProfiles(u.profiles.map((p) => p.profile))
          : legacyRoleToProfiles(u.role);
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          profilesLabel: formatProfilesLabel(profiles),
          avatarColor: u.avatarColor,
        };
      })
    : [{
        id: session.id,
        name: session.name,
        role: session.role,
        profilesLabel: formatProfilesLabel(session.profiles ?? legacyRoleToProfiles(session.role)),
        avatarColor: "#6366f1",
      }];

  if (viewMode === "bi") {
    const teamData = await getTeamOverview(from, to);
    return (
      <ReportsClient
        view="bi"
        isAdmin={isAdmin}
        users={users}
        selectedUserId={targetUserId}
        from={from.toISOString().slice(0, 10)}
        to={to.toISOString().slice(0, 10)}
        teamData={teamData}
        includeAcademic={includeAcademic}
      />
    );
  }

  const summary = await getUserActivitySummary(targetUserId, from, to);

  return (
    <ReportsClient
      view="report"
      isAdmin={isAdmin}
      users={users}
      selectedUserId={targetUserId}
      from={from.toISOString().slice(0, 10)}
      to={to.toISOString().slice(0, 10)}
      summary={summary}
      includeAcademic={includeAcademic}
    />
  );
}
