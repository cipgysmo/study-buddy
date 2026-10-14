import { redirect } from "next/navigation";

export default async function MockExamsPage() {
  redirect("/activities?tab=mock");
}
