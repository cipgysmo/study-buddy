import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QuizSession } from "@/components/quizzes/quiz-session";
import { getQuiz, listQuestions } from "@/lib/quizzes";
import { getSubject } from "@/lib/subjects";

export default async function QuizSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("Quizzes");
  const { id } = await params;
  const quiz = getQuiz(id);
  if (!quiz) notFound();
  const subject = getSubject(quiz.subject_id);
  const questions = listQuestions(id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{quiz.title}</h1>
        <p className="mt-1 text-muted">
          {subject?.name ?? t("title")}
          {quiz.duration_min ? ` · ${quiz.duration_min} ${t("min")}` : ""}
        </p>
      </header>
      <QuizSession
        quiz={{
          id: quiz.id,
          title: quiz.title,
          duration_min: quiz.duration_min,
          source_refs: quiz.source_refs,
        }}
        questions={questions}
        subjectId={quiz.subject_id}
      />
    </div>
  );
}
