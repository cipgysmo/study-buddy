import { getTranslations } from "next-intl/server";
import { dueFlashcards } from "@/lib/flashcards";
import { listSubjects } from "@/lib/subjects";
import { FlashcardsApp } from "@/components/flashcards/flashcards-app";

export default async function FlashcardsPage() {
  const t = await getTranslations("Flashcards");
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));
  const initialDue = dueFlashcards().map((c) => ({ id: c.id, front: c.front, back: c.back }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <FlashcardsApp subjects={subjects} initialDue={initialDue} />
    </div>
  );
}
