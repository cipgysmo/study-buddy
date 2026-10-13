"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MockExamsApp } from "@/components/mock-exams/mock-exams-app";
import { PracticeApp } from "@/components/practice/practice-app";
import { QuizzesApp } from "@/components/quizzes/quizzes-app";
import type { SubjectOption } from "@/components/ui/subject-select";

type Tab = "quizzes" | "mock" | "practice";

export function ActivitiesApp({
  quizzes,
  mockExams,
  exercises,
  items,
  typedExercises,
  subjects,
  initialSubjectId = "",
  initialTab = "quizzes",
}: {
  quizzes: Parameters<typeof QuizzesApp>[0]["quizzes"];
  mockExams: Parameters<typeof MockExamsApp>[0]["exams"];
  exercises: Parameters<typeof PracticeApp>[0]["exercises"];
  items: Parameters<typeof PracticeApp>[0]["items"];
  typedExercises: Parameters<typeof PracticeApp>[0]["typedExercises"];
  subjects: SubjectOption[];
  initialSubjectId?: string;
  initialTab?: Tab;
}) {
  const t = useTranslations("Nav");
  const tq = useTranslations("Quizzes");
  const tm = useTranslations("MockExams");
  const tp = useTranslations("Practice");
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: "quizzes", label: tq("title") },
    { id: "mock", label: tm("title") },
    { id: "practice", label: tp("title") },
  ];

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={
              "min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (tab === item.id
                ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                : "text-muted hover:text-foreground")
            }
            aria-label={t("activities")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "quizzes" && (
        <QuizzesApp quizzes={quizzes} subjects={subjects} initialSubjectId={initialSubjectId} />
      )}
      {tab === "mock" && <MockExamsApp exams={mockExams} subjects={subjects} />}
      {tab === "practice" && (
        <PracticeApp
          exercises={exercises}
          items={items}
          typedExercises={typedExercises}
          subjects={subjects}
          initialSubjectId={initialSubjectId}
        />
      )}
    </div>
  );
}
