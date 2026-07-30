import { redirect } from "next/navigation";

export default async function PublicationDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Legacy publication ids are not project ids; send to papers list.
  void id;
  redirect("/papers");
}
