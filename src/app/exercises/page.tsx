import { getTranslations } from "next-intl/server";
import { listExercises, listTrueFalse } from "@/lib/practice";
import { listSubjects } from "@/lib/subjects";
import { PracticeApp } from "@/components/practice/practice-app";

export default async function ExercisesPage() {
  const t = await getTranslations("Practice");
  const exercises = listExercises().map((e) => ({
    id: e.id,
    prompt: e.prompt,
    solution_steps: e.solution_steps,
    difficulty: e.difficulty,
  }));
  const items = listTrueFalse().map((i) => ({
    id: i.id,
    statement: i.statement,
    is_correct: i.is_correct,
    explanation: i.explanation,
  }));
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <PracticeApp exercises={exercises} items={items} subjects={subjects} />
    </div>
  );
}
