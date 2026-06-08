import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: session.id } });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
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
