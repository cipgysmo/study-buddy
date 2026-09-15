import { getTranslations } from "next-intl/server";
import { listQuizzes } from "@/lib/quizzes";
import { listSubjects } from "@/lib/subjects";
import { QuizzesApp } from "@/components/quizzes/quizzes-app";

export default async function QuizzesPage() {
  const t = await getTranslations("Quizzes");
  const quizzes = listQuizzes().map((q) => ({ id: q.id, title: q.title }));
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <QuizzesApp quizzes={quizzes} subjects={subjects} />
    </div>
  );
}
