import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listSubjects } from "@/lib/subjects";
import { dueFlashcards } from "@/lib/flashcards";
import { getProgress } from "@/lib/progress";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const subjects = listSubjects();
  const due = dueFlashcards();
  const { streak } = getProgress();

  const links = [
    { href: "/chat", label: t("chat") },
    { href: "/flashcards", label: t("flashcards") },
    { href: "/quizzes", label: t("quizzes") },
    { href: "/exercises", label: t("exercises") },
    { href: "/scan", label: t("scan") },
    { href: "/progress", label: t("progress") },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("greeting")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("subjects")} value={subjects.length} />
        <StatCard label={t("due")} value={due.length} />
        <StatCard label={t("streak")} value={streak.current} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">{t("quickLinks")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-2xl border border-border bg-card p-4 font-medium transition-colors hover:border-accent"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
