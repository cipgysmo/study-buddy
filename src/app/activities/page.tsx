import { getTranslations } from "next-intl/server";
import { ActivitiesApp } from "@/components/activities/activities-app";
import { listExercises, listTrueFalse } from "@/lib/practice";
import { listQuizzes, listTimedQuizzes } from "@/lib/quizzes";
import { listSubjects } from "@/lib/subjects";
import { listTypedExercises } from "@/lib/typed-exercises";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; tab?: string }>;
}) {
  const t = await getTranslations("Nav");
  const { subject, tab } = await searchParams;
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name, color: s.color }));
  const quizzes = listQuizzes().map((q) => ({
    id: q.id,
    subject_id: q.subject_id,
    title: q.title,
    created_at: q.created_at,
    source_refs: q.source_refs,
  }));
  const mockExams = listTimedQuizzes().map((q) => ({
    id: q.id,
    subject_id: q.subject_id,
    title: q.title,
    duration_min: q.duration_min as number,
    created_at: q.created_at,
    source_refs: q.source_refs,
  }));
  const exercises = listExercises(subject).map((e) => ({
    id: e.id,
    subject_id: e.subject_id,
    prompt: e.prompt,
    solution_steps: e.solution_steps,
    difficulty: e.difficulty,
    created_at: e.created_at,
    source_refs: e.source_refs,
  }));
  const items = listTrueFalse(subject).map((i) => ({
    id: i.id,
    subject_id: i.subject_id,
    statement: i.statement,
    is_correct: i.is_correct,
    explanation: i.explanation,
    created_at: i.created_at,
    source_refs: i.source_refs,
  }));
  const typedExercises = listTypedExercises(subject).map((e) => ({
    id: e.id,
    subject_id: e.subject_id,
    prompt: e.prompt,
    expected_answer: e.expected_answer,
    accepted_answers: e.accepted_answers,
    grading_mode: e.grading_mode,
    explanation: e.explanation,
    difficulty: e.difficulty,
    created_at: e.created_at,
    source_refs: e.source_refs,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("activities")}</h1>
        <p className="mt-1 text-muted">Quizzes, mock exams, and practice in one place.</p>
      </header>
      <ActivitiesApp
        quizzes={quizzes}
        mockExams={mockExams}
        exercises={exercises}
        items={items}
        typedExercises={typedExercises}
        subjects={subjects}
        initialSubjectId={subject ?? ""}
        initialTab={tab === "mock" || tab === "practice" ? tab : "quizzes"}
      />
    </div>
  );
}
