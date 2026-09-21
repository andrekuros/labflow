import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { visibleNavItems } from "@/lib/nav-visibility";
import { unreadCount } from "@/lib/notifications";
import { Sidebar } from "@/components/sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { formatProfilesLabel, resolveProfiles } from "@/lib/profile-meta";
import { parsePreferences } from "@/lib/user-preferences";
import { getLabBranding } from "@/lib/lab-branding";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  await bootstrapAsync();

  const [user, unread, branding] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id } }),
    unreadCount(session.id),
    getLabBranding(),
  ]);

  const preferences = parsePreferences(user?.preferences);
  const filteredNav = await visibleNavItems(session, preferences);

  const userInfo = {
    name: user?.name ?? session.name,
    role: user?.role ?? session.role,
    profilesLabel: formatProfilesLabel(resolveProfiles(session)),
    avatarColor: user?.avatarColor,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppTopbar
        branding={branding}
        preferences={preferences}
        unreadNotifications={unread}
        user={userInfo}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar navItems={filteredNav} preferences={preferences} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
