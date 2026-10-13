import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { groupItemsBySubjectAndDay } from "@/lib/list-view";
import { countChapters, listLessons } from "@/lib/lessons";
import { getSubject, listSubjects } from "@/lib/subjects";
import { DeleteButton } from "@/components/subjects/delete-button";

export default async function LessonsPage() {
  const t = await getTranslations("Lessons");
  const locale = await getLocale();
  const lessons = listLessons();
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name, color: s.color }));
  const groups = groupItemsBySubjectAndDay(lessons, subjects, locale);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      {lessons.length === 0 ? (
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
                    {day.items.map((l) => {
                      const subject = getSubject(l.subject_id);
                      const count = countChapters(l.id);
                      return (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                        >
                          <Link href={`/lessons/${l.id}`} className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: subject?.color ?? "#0071e3" }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{l.title}</span>
                              <span className="block truncate text-xs text-muted">
                                {subject?.name ?? ""}
                                {" · "}
                                {l.status === "ready"
                                  ? t("chapterCount", { count })
                                  : l.status === "processing"
                                    ? t("processing")
                                    : t("failed")}
                              </span>
                            </span>
                          </Link>
                          <DeleteButton href={`/api/lessons/${l.id}`} label={t("delete")} />
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
