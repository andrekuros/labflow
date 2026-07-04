import { redirect } from "next/navigation";

export default function RoadmapRedirect() {
  redirect("/planning?tab=roadmap");
}
