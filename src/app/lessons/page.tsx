import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { countChapters, listLessons } from "@/lib/lessons";
import { getSubject } from "@/lib/subjects";
import { DeleteButton } from "@/components/subjects/delete-button";

export default async function LessonsPage() {
  const t = await getTranslations("Lessons");
  const lessons = listLessons();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      {lessons.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {lessons.map((l) => {
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
      )}
    </div>
  );
}
