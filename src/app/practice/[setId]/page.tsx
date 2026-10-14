import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PracticeApp } from "@/components/practice/practice-app";
import { PracticeSessionProgress } from "@/components/practice/practice-session-progress";
import { formatDate } from "@/lib/format";
import { getPracticeSet, getPracticeSetItems, touchPracticeSet } from "@/lib/practice-sets";
import { isPracticeTab } from "@/lib/practice-types";
import { listSubjects } from "@/lib/subjects";
import { getTimezone } from "@/lib/timezone";

export default async function PracticeSetPage({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("Practice");
  const locale = await getLocale();
  const timezone = getTimezone();
  const { setId } = await params;
  const { tab } = await searchParams;
  const set = getPracticeSet(setId);
  if (!set) notFound();
  touchPracticeSet(setId);

  const data = getPracticeSetItems(setId);
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name, color: s.color }));
  const subject = subjects.find((s) => s.id === set.subject_id);
  const fallbackTab =
    set.kind === "truefalse" ? "truefalse" : set.kind === "typed" ? "typed" : "exercises";
  const initialTab = isPracticeTab(tab) ? tab : fallbackTab;

  return (
    <div className="space-y-5">
      <Link href="/activities?tab=practice" className="text-sm text-muted hover:text-foreground">
        {t("backToSessions")}
      </Link>

      <header className="space-y-3">
        <div>
          <p className="text-sm font-medium text-accent">{t("session")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t(`kind_${set.kind}`)}</h1>
          <p className="mt-1 text-sm text-muted">
            {subject?.name ?? "—"} · {formatDate(set.created_at, locale, timezone)}
            {set.last_opened_at ? ` · ${t("lastOpened", { date: formatDate(set.last_opened_at, locale, timezone) })}` : ""}
          </p>
        </div>
        <PracticeSessionProgress
          exercises={data.exercises}
          items={data.items}
          typedExercises={data.typedExercises}
        />
      </header>

      <PracticeApp
        exercises={data.exercises}
        items={data.items}
        typedExercises={data.typedExercises}
        subjects={subjects}
        initialSubjectId={set.subject_id}
        initialSetId={setId}
        initialTab={initialTab}
        sessionMode
      />
    </div>
  );
}
