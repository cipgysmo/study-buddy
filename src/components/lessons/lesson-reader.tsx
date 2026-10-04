"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RichText } from "@/components/ui/rich-text";
import { Diagram } from "@/components/ui/diagram";
import type { Lesson, LessonChapter } from "@/lib/lessons";

export function LessonReader({
  lessonId,
  initialLesson,
  initialChapters,
  subjectColor,
}: {
  lessonId: string;
  initialLesson: Lesson;
  initialChapters: LessonChapter[];
  subjectColor: string;
}) {
  const t = useTranslations("Lessons");
  const [lesson, setLesson] = useState(initialLesson);
  const [chapters, setChapters] = useState(initialChapters);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<string, number>>({});

  // While the build job is running, poll so chapters appear progressively.
  useEffect(() => {
    if (lesson.status !== "processing") return;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/lessons/${lessonId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { lesson: Lesson; chapters: LessonChapter[] };
        if (stop) return;
        setLesson(d.lesson);
        setChapters(d.chapters);
        if (d.lesson.status !== "processing") clearInterval(timer);
      } catch {
        /* transient; retry next tick */
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [lesson.status, lessonId]);

  const chapter = chapters[idx];

  const askUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("subjectId", lesson.subject_id);
    for (const tid of lesson.topic_ids) params.append("topicIds", tid);
    params.set(
      "prompt",
      chapter
        ? `Please help me understand: ${chapter.title}. ${chapter.summary}`
        : `Please help me with: ${lesson.title}`
    );
    return `/chat?${params.toString()}`;
  }, [lesson, chapter]);

  return (
    <div className="space-y-4">
      <Link href="/lessons" className="text-sm text-muted hover:text-foreground">
        {t("backToLessons")}
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: subjectColor }} />
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        {lesson.status === "processing" && (
          <span className="text-sm text-muted">{t("generatingChapters")}</span>
        )}
        {lesson.status === "failed" && <span className="text-sm text-danger">{t("failed")}</span>}
      </header>

      <div className="flex flex-col gap-4 sm:flex-row">
        <aside className="flex shrink-0 flex-row flex-wrap gap-1 sm:w-56 sm:flex-col">
          {chapters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setIdx(i)}
              className={
                "min-w-0 rounded-lg px-3 py-2 text-left text-sm " +
                (i === idx
                  ? "bg-foreground/10 font-medium"
                  : "text-muted hover:bg-foreground/5")
              }
            >
              {i + 1}. {c.title}
            </button>
          ))}
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-5">
          {chapter ? (
            <>
              <p className="text-xs text-muted">
                {t("chapterOf", { n: idx + 1, total: chapters.length })}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{chapter.title}</h2>
              {chapter.diagram && (
                <div className="my-3">
                  <Diagram svg={chapter.diagram} />
                </div>
              )}
              <RichText content={chapter.body} className="mt-2" />
              {chapter.figure_ids.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted">{t("figures")}</p>
                  <div className="flex flex-wrap gap-2">
                    {chapter.figure_ids.map((fid) => (
                      // eslint-disable-next-line @next/next/no-img-element -- same-origin API serves the stored image; next/image adds no value
                      <img
                        key={fid}
                        src={`/api/materials/${fid}`}
                        alt=""
                        loading="lazy"
                        className="max-h-64 rounded-lg border border-border"
                      />
                    ))}
                  </div>
                </div>
              )}
              {chapter.check && (
                <CheckBlock
                  check={chapter.check}
                  picked={picks[chapter.id]}
                  onPick={(oi) => setPicks((s) => ({ ...s, [chapter.id]: oi }))}
                />
              )}
              <div className="mt-5 flex items-center justify-between gap-2">
                <button
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-40"
                >
                  {t("prev")}
                </button>
                <Link href={askUrl} className="text-sm text-accent hover:underline">
                  {t("askTutor")}
                </Link>
                <button
                  onClick={() => setIdx((i) => Math.min(chapters.length - 1, i + 1))}
                  disabled={idx >= chapters.length - 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-40"
                >
                  {t("next")}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              {lesson.status === "processing" ? t("generatingChapters") : t("empty")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function CheckBlock({
  check,
  picked,
  onPick,
}: {
  check: NonNullable<LessonChapter["check"]>;
  picked: number | undefined;
  onPick: (i: number) => void;
}) {
  const t = useTranslations("Lessons");
  const answered = picked !== undefined;
  const correct = picked === check.answerIndex;
  return (
    <div className="mt-5 rounded-xl border border-border bg-background/50 p-4">
      <p className="text-sm font-semibold">{t("checkUnderstanding")}</p>
      <p className="mt-1 text-sm">{check.question}</p>
      <div className="mt-2 space-y-2">
        {check.options.map((opt, oi) => {
          const isCorrect = oi === check.answerIndex;
          const isChosen = oi === picked;
          return (
            <button
              key={oi}
              disabled={answered}
              onClick={() => onPick(oi)}
              className={
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                (isCorrect
                  ? "border-success bg-success/10"
                  : isChosen
                    ? "border-danger bg-danger/10"
                    : answered
                      ? "border-border opacity-70"
                      : "border-border hover:border-accent")
              }
            >
              <span className="w-4 shrink-0 text-center">
                {isCorrect ? "✓" : isChosen ? "✗" : ""}
              </span>
              <span className="min-w-0 flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={"mt-2 text-sm " + (correct ? "text-success" : "text-danger")}>
          {correct ? t("checkCorrect") : t("checkIncorrect")}
        </p>
      )}
      {answered && check.explanation && (
        <RichText content={check.explanation} className="mt-1 text-sm text-muted" />
      )}
    </div>
  );
}
