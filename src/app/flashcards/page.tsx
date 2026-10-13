import { getTranslations } from "next-intl/server";
import { dueFlashcards, listFlashcards } from "@/lib/flashcards";
import { listSubjects } from "@/lib/subjects";
import { FlashcardsApp } from "@/components/flashcards/flashcards-app";

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const t = await getTranslations("Flashcards");
  const { subject } = await searchParams;
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name, color: s.color }));
  const initialDue = dueFlashcards(subject).map((c) => ({ id: c.id, front: c.front, back: c.back }));
  const allCards = listFlashcards(subject).map((c) => ({
    id: c.id,
    subject_id: c.subject_id,
    front: c.front,
    back: c.back,
    created_at: c.created_at,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <FlashcardsApp
        subjects={subjects}
        initialDue={initialDue}
        allCards={allCards}
        initialSubjectId={subject ?? ""}
      />
    </div>
  );
}
