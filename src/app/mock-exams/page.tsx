import { getTranslations } from "next-intl/server";
import { listTimedQuizzes } from "@/lib/quizzes";
import { listSubjects } from "@/lib/subjects";
import { MockExamsApp } from "@/components/mock-exams/mock-exams-app";

export default async function MockExamsPage() {
  const t = await getTranslations("MockExams");
  const exams = listTimedQuizzes().map((q) => ({
    id: q.id,
    title: q.title,
    duration_min: q.duration_min as number,
  }));
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <MockExamsApp exams={exams} subjects={subjects} />
    </div>
  );
}
