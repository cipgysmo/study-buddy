import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSubject, listMaterials } from "@/lib/subjects";
import { UploadMaterialForm } from "@/components/subjects/upload-material-form";
import { DeleteButton } from "@/components/subjects/delete-button";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("Subjects");
  const { id } = await params;
  const subject = getSubject(id);
  if (!subject) notFound();
  const materials = listMaterials(id);

  return (
    <div className="space-y-6">
      <Link href="/subjects" className="text-sm text-muted hover:text-foreground">
        {t("backToSubjects")}
      </Link>

      <header className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: subject.color }} />
        <h1 className="text-3xl font-semibold tracking-tight">{subject.name}</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("materials")}</h2>
        <UploadMaterialForm subjectId={id} />
        {materials.length === 0 ? (
          <p className="text-sm text-muted">{t("noMaterials")}</p>
        ) : (
          <ul className="space-y-2">
            {materials.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.filename}</span>
                  <span className="block text-xs text-muted">
                    {m.kind === "image"
                      ? t("image")
                      : m.extracted_text
                        ? `${m.extracted_text.length} ${t("chars")}`
                        : "—"}
                  </span>
                </span>
                <DeleteButton href={`/api/materials/${m.id}`} label={t("deleteMaterial")} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
