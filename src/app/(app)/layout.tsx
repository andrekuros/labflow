import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { getNavItems } from "@/plugins/registry";
import { unreadCount } from "@/lib/notifications";
import { Sidebar } from "@/components/sidebar";
import { parsePreferences } from "@/lib/user-preferences";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  await bootstrapAsync();

  const [user, navItems, unread] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id } }),
    getNavItems(),
    unreadCount(session.id),
  ]);

  const preferences = parsePreferences(user?.preferences);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        navItems={navItems}
        unreadNotifications={unread}
        preferences={preferences}
        user={{
          name: user?.name ?? session.name,
          role: user?.role ?? session.role,
          avatarColor: user?.avatarColor,
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] p-6">{children}</div>
      </main>
    </div>
  );
}
