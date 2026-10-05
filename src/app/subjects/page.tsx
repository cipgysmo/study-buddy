import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/shell/nav-icons";
import { CreateSubjectForm } from "@/components/subjects/create-subject-form";
import { DeleteButton } from "@/components/subjects/delete-button";
import { UploadMaterialForm } from "@/components/subjects/upload-material-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { dueFlashcards } from "@/lib/flashcards";
import { listSubjects } from "@/lib/subjects";

export default async function SubjectsPage() {
  const t = await getTranslations("Subjects");
  const subjects = listSubjects();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <CreateSubjectForm />

      <UploadMaterialForm
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
      />

      {subjects.length === 0 ? (
        <EmptyState
          title={t("empty")}
          icon={<NavIcon name="subjects" className="h-5 w-5" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => {
            const due = dueFlashcards(s.id).length;
            return (
              <li key={s.id}>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-accent">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/subjects/${s.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block text-xs text-muted">
                          {t("materialsCount", { count: s.materialCount })}
                          {due > 0 && ` · ${t("dueCards", { count: due })}`}
                        </span>
                      </span>
                    </Link>
                    <DeleteButton href={`/api/subjects/${s.id}`} label={t("deleteSubject")} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
