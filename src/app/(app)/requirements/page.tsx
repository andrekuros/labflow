import { redirect } from "next/navigation";

export default function RequirementsRedirect() {
  redirect("/planning?tab=requirements");
}
