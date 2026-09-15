import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listSubjects } from "@/lib/subjects";
import { CreateSubjectForm } from "@/components/subjects/create-subject-form";
import { DeleteButton } from "@/components/subjects/delete-button";

export default async function SubjectsPage() {
  const t = await getTranslations("Subjects");
  const subjects = listSubjects();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <CreateSubjectForm />

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          {t("empty")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <Link href={`/subjects/${s.id}`} className="flex min-w-0 items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">
                    {s.materialCount} {t("materials").toLowerCase()}
                  </span>
                </span>
              </Link>
              <DeleteButton href={`/api/subjects/${s.id}`} label={t("deleteSubject")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
