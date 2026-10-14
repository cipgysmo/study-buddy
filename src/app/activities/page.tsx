import { getTranslations } from "next-intl/server";
import { ActivitiesApp } from "@/components/activities/activities-app";
import { listExercises, listTrueFalse } from "@/lib/practice";
import { isPracticeTab } from "@/lib/practice-types";
import { listQuizzes, listTimedQuizzes } from "@/lib/quizzes";
import { listSubjects } from "@/lib/subjects";
import { listTypedExercises } from "@/lib/typed-exercises";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; tab?: string; practiceTab?: string; set?: string }>;
}) {
  const t = await getTranslations("Activities");
  const { subject, tab, practiceTab, set } = await searchParams;
  const initialTab = tab === "mock" || tab === "practice" ? tab : "quizzes";
  const initialPracticeTab = isPracticeTab(practiceTab) ? practiceTab : "exercises";
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
    set_id: e.set_id,
  }));
  const items = listTrueFalse(subject).map((i) => ({
    id: i.id,
    subject_id: i.subject_id,
    statement: i.statement,
    is_correct: i.is_correct,
    explanation: i.explanation,
    created_at: i.created_at,
    source_refs: i.source_refs,
    set_id: i.set_id,
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
    set_id: e.set_id,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <ActivitiesApp
        quizzes={quizzes}
        mockExams={mockExams}
        exercises={exercises}
        items={items}
        typedExercises={typedExercises}
        subjects={subjects}
        initialSubjectId={subject ?? ""}
        initialTab={initialTab}
        initialPracticeTab={initialPracticeTab}
        initialSetId={set ?? ""}
      />
    </div>
  );
}
