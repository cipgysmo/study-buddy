import { getTranslations } from "next-intl/server";
import { listExercises, listTrueFalse } from "@/lib/practice";
import { listSubjects } from "@/lib/subjects";
import { listTypedExercises } from "@/lib/typed-exercises";
import { PracticeApp } from "@/components/practice/practice-app";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const t = await getTranslations("Practice");
  const { subject } = await searchParams;
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
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name, color: s.color }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <PracticeApp
        exercises={exercises}
        items={items}
        typedExercises={typedExercises}
        subjects={subjects}
        initialSubjectId={subject ?? ""}
      />
    </div>
  );
}
