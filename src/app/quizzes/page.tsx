import { redirect } from "next/navigation";

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "quizzes");
  if (subject) params.set("subject", subject);
  redirect(`/activities?${params.toString()}`);
}
