import { requireUser } from "@/lib/rbac";
import AcademicPage, { AcademicUserPage } from "@/plugins/academic/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const session = await requireUser();
  const { user: userId } = await searchParams;

  if (userId && (session.role === "admin" || session.role === "researcher")) {
    const view = await AcademicUserPage(userId, session);
    if (view) return view;
  }

  return <AcademicPage />;
}
