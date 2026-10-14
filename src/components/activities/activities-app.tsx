"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MockExamsApp } from "@/components/mock-exams/mock-exams-app";
import { PracticeApp } from "@/components/practice/practice-app";
import { QuizzesApp } from "@/components/quizzes/quizzes-app";
import type { SubjectOption } from "@/components/ui/subject-select";
import { isPracticeTab, type PracticeTab } from "@/lib/practice-types";

type Tab = "quizzes" | "mock" | "practice";

function isTab(value: unknown): value is Tab {
  return value === "quizzes" || value === "mock" || value === "practice";
}

export function ActivitiesApp({
  quizzes,
  mockExams,
  exercises,
  items,
  typedExercises,
  subjects,
  initialSubjectId = "",
  initialTab = "quizzes",
  initialPracticeTab = "exercises",
  initialSetId = "",
}: {
  quizzes: Parameters<typeof QuizzesApp>[0]["quizzes"];
  mockExams: Parameters<typeof MockExamsApp>[0]["exams"];
  exercises: Parameters<typeof PracticeApp>[0]["exercises"];
  items: Parameters<typeof PracticeApp>[0]["items"];
  typedExercises: Parameters<typeof PracticeApp>[0]["typedExercises"];
  subjects: SubjectOption[];
  initialSubjectId?: string;
  initialTab?: Tab;
  initialPracticeTab?: PracticeTab;
  initialSetId?: string;
}) {
  const t = useTranslations("Nav");
  const tq = useTranslations("Quizzes");
  const tm = useTranslations("MockExams");
  const tp = useTranslations("Practice");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTab = searchParams?.get("tab") ?? null;
  const urlPracticeTab = searchParams?.get("practiceTab") ?? null;
  const urlSet = searchParams?.get("set") ?? null;
  const [tab, setTab] = useState<Tab>(isTab(urlTab) ? urlTab : initialTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: "quizzes", label: tq("title") },
    { id: "mock", label: tm("title") },
    { id: "practice", label: tp("title") },
  ];

  function changeTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", next);
    if (next !== "practice") {
      params.delete("practiceTab");
      params.delete("set");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const practiceTab = isPracticeTab(urlPracticeTab) ? urlPracticeTab : initialPracticeTab;
  const setId = urlSet ?? initialSetId;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={t("activities")} className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => changeTab(item.id)}
            className={
              "min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (tab === item.id
                ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                : "text-muted hover:text-foreground")
            }
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
          initialTab={practiceTab}
          initialSetId={setId}
          tabParamName="practiceTab"
        />
      )}
    </div>
  );
}
