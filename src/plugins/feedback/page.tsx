import { requireUser, hasPermission } from "@/lib/rbac";
import { listFeedbacks, listUsers, listActiveProjects } from "@/plugins/feedback/actions";
import { FeedbackPage } from "@/components/feedback/feedback-client";

export default async function FeedbackPluginPage() {
  const session = await requireUser();
  const canManage = await hasPermission(session, "feedback:manage");
  const [feedbacks, users, projects] = await Promise.all([
    listFeedbacks(),
    canManage ? listUsers() : Promise.resolve([]),
    listActiveProjects(),
  ]);

  return (
    <FeedbackPage
      feedbacks={feedbacks.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        comments: f.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      }))}
      canManage={canManage}
      currentUserId={session.id}
      users={users}
      projects={projects}
    />
  );
}
