import { redirect } from "next/navigation";

export default function SprintsRedirect() {
  redirect("/planning?tab=sprints");
}
