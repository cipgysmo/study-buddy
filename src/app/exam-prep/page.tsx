import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listPlans } from "@/lib/plans";
import { listSubjects } from "@/lib/subjects";
import { CreatePlanForm } from "@/components/exam-prep/create-plan-form";
import { DeleteButton } from "@/components/subjects/delete-button";

export default async function ExamPrepPage() {
  const t = await getTranslations("ExamPrep");
  const plans = listPlans();
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <CreatePlanForm subjects={subjects} />

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          {t("empty")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <Link href={`/exam-prep/${p.id}`} className="min-w-0">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="block text-xs text-muted">{p.exam_date}</span>
              </Link>
              <DeleteButton href={`/api/study-plans/${p.id}`} label={t("deletePlan")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
