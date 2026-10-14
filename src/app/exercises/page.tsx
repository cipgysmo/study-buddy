import { redirect } from "next/navigation";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; tab?: string; set?: string }>;
}) {
  const { subject, tab, set } = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "practice");
  if (tab) params.set("practiceTab", tab);
  if (subject) params.set("subject", subject);
  if (set) params.set("set", set);
  redirect(`/activities?${params.toString()}`);
}
