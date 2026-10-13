import { getLocale, getTranslations } from "next-intl/server";
import { getWeakSpots, listAttemptsPage } from "@/lib/attempts";
import { groupItemsBySubjectAndDay } from "@/lib/list-view";
import { listSubjects } from "@/lib/subjects";

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
  const groups = groupItemsBySubjectAndDay(items, subjects, locale);

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
                    {day.items.map((attempt) => (
                      <li
                        key={attempt.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {t(`kind_${attempt.kind}`)}
                          {attempt.subject_name ? ` · ${attempt.subject_name}` : ""}
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
                          {attempt.score == null
                            ? attempt.correct === false
                              ? t("incorrect")
                              : t("correct")
                            : `${attempt.score}%`}
                        </span>
                      </li>
                    ))}
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
