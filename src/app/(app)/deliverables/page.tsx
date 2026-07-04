import { redirect } from "next/navigation";

export default function DeliverablesRedirect() {
  redirect("/planning?tab=deliverables");
}
