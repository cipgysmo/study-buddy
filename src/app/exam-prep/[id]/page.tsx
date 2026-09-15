import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlan, listPlanItems } from "@/lib/plans";
import { PlanTimeline } from "@/components/exam-prep/plan-timeline";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("ExamPrep");
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) notFound();
  const items = listPlanItems(id);

  return (
    <div className="space-y-6">
      <Link href="/exam-prep" className="text-sm text-muted hover:text-foreground">
        {t("backToPlans")}
      </Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{plan.title}</h1>
        <p className="mt-1 text-muted">
          {plan.exam_date}
          {plan.target_grade ? ` · ${plan.target_grade}` : ""}
        </p>
      </header>
      <PlanTimeline
        items={items.map((i) => ({
          id: i.id,
          dayIndex: i.day_index,
          date: i.date,
          topic: i.topic,
          instructions: i.instructions,
          done: !!i.done,
        }))}
      />
    </div>
  );
}
