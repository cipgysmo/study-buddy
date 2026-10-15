import { getLocale, getTranslations } from "next-intl/server";
import { getWeakSpots, listAttemptsPage } from "@/lib/attempts";
import { groupItemsBySubjectAndDay } from "@/lib/list-view";
import { listSubjects } from "@/lib/subjects";
import { getTimezone } from "@/lib/timezone";

interface QuizDetail {
  prompt: string;
  answer: string | null;
  correctAnswer: string;
  correct: boolean;
}

interface AttemptPayload {
  title?: string | null;
  score?: number | null;
  total?: number | null;
  details?: QuizDetail[];
  prompt?: string;
  answer?: string | boolean;
  expected_answer?: string;
  accepted_answers?: string[];
  feedback?: string;
  statement?: string;
  correct_answer?: boolean;
  explanation?: string;
}

function parsePayload(value: string | null): AttemptPayload | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as AttemptPayload;
  } catch {
    return null;
  }
}

function formatAnswer(
  value: string | boolean | null | undefined,
  trueLabel: string,
  falseLabel: string
): string {
  if (typeof value === "boolean") return value ? trueLabel : falseLabel;
  return value ?? "—";
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; kind?: string }>;
}) {
  const t = await getTranslations("History");
  const locale = await getLocale();
  const { subject, kind } = await searchParams;
  const params = new URLSearchParams({ limit: "100" });
  if (subject) params.set("subjectId", subject);
  if (kind) params.set("kind", kind);
  const { items } = listAttemptsPage(params);
  const weakSpots = getWeakSpots(subject);
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name, color: s.color }));
  const timezone = getTimezone();
  const groups = groupItemsBySubjectAndDay(items, subjects, locale, "desc", timezone);
  const fmt = (v: string | boolean | null | undefined) =>
    formatAnswer(v, t("answerTrue"), t("answerFalse"));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      {weakSpots.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("weakSpots")}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {weakSpots.slice(0, 8).map((w) => (
              <li key={`${w.subject_id}-${w.kind}`}>
                {w.subject_name} · {t(`kind_${w.kind}`)} · {t("incorrectCount", { count: w.incorrect })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((section) => (
            <section key={section.subjectId ?? "all"} className="space-y-3">
              {section.subjectName && (
                <div className="flex items-center gap-2">
                  {section.color && (
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
                  )}
                  <h2 className="text-sm font-semibold">{section.subjectName}</h2>
                </div>
              )}
              {section.dayGroups.map((day) => (
                <div key={day.dayKey} className="space-y-2">
                  {(day.dayLabel || day.timeLabel) && (
                    <p className="text-xs font-medium text-muted">
                      {day.dayLabel}
                      {day.timeLabel ? ` · ${day.timeLabel}` : ""}
                      <span className="ml-2 opacity-70">({day.items.length})</span>
                    </p>
                  )}
                  <ul className="space-y-2">
                    {day.items.map((attempt) => {
                      const payload = parsePayload(attempt.payload);
                      const summary =
                        attempt.kind === "quiz" && payload?.score != null && payload?.total != null
                          ? `${payload.score}/${payload.total}`
                          : attempt.score == null
                            ? attempt.correct === false
                              ? t("incorrect")
                              : t("correct")
                            : `${attempt.score}%`;
                      const title =
                        payload?.title ??
                        payload?.prompt ??
                        payload?.statement ??
                        t(`kind_${attempt.kind}`);
                      return (
                        <li key={attempt.id} className="rounded-xl border border-border bg-card">
                          <details className="group">
                            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
                              <span className="min-w-0 truncate">
                                <span className="font-medium">{title}</span>
                                {attempt.subject_name ? (
                                  <span className="block truncate text-xs text-muted">
                                    {attempt.subject_name}
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={
                                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                                  (attempt.correct === false
                                    ? "bg-danger/10 text-danger"
                                    : attempt.correct === true
                                      ? "bg-success/10 text-success"
                                      : "bg-foreground/5 text-muted")
                                }
                              >
                                {summary}
                              </span>
                            </summary>
                            <div className="space-y-3 border-t border-border px-3 py-3 text-sm">
                              {payload?.details?.length ? (
                                <ul className="space-y-3">
                                  {payload.details.map((d, i) => (
                                    <li key={i} className="space-y-1">
                                      <p className="font-medium">{d.prompt}</p>
                                      <p className="text-muted">
                                        {t("yourAnswer")}: {fmt(d.answer)}
                                      </p>
                                      <p className="text-muted">
                                        {t("correctAnswer")}: {fmt(d.correctAnswer)}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              {payload?.prompt ? (
                                <div className="space-y-1">
                                  <p className="font-medium">{payload.prompt}</p>
                                  <p className="text-muted">
                                    {t("yourAnswer")}: {fmt(payload.answer)}
                                  </p>
                                  {payload.expected_answer ? (
                                    <p className="text-muted">
                                      {t("correctAnswer")}: {payload.expected_answer}
                                    </p>
                                  ) : null}
                                  {payload.accepted_answers?.length ? (
                                    <p className="text-muted">
                                      {t("acceptedAnswers")}: {payload.accepted_answers.join(", ")}
                                    </p>
                                  ) : null}
                                  {payload.feedback ? (
                                    <p className="text-muted">
                                      {t("feedback")}: {payload.feedback}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {payload?.statement ? (
                                <div className="space-y-1">
                                  <p className="font-medium">{payload.statement}</p>
                                  <p className="text-muted">
                                    {t("yourAnswer")}: {fmt(payload.answer)}
                                  </p>
                                  <p className="text-muted">
                                    {t("correctAnswer")}: {fmt(payload.correct_answer)}
                                  </p>
                                  {payload.explanation ? (
                                    <p className="text-muted">
                                      {t("explanation")}: {payload.explanation}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
