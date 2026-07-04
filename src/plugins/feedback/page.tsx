import { requireUser, hasPermission } from "@/lib/rbac";
import { listFeedbacks } from "@/plugins/feedback/actions";
import { FeedbackPage } from "@/components/feedback/feedback-client";

export default async function FeedbackPluginPage() {
  const session = await requireUser();
  const canManage = await hasPermission(session, "feedback:manage");
  const feedbacks = await listFeedbacks();

  return (
    <FeedbackPage
      feedbacks={feedbacks.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      }))}
      canManage={canManage}
    />
  );
}
