import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatCard } from "@/components/ui/stat-card";
import { NavIcon } from "@/components/shell/nav-icons";
import { listSubjects } from "@/lib/subjects";
import { dueFlashcards } from "@/lib/flashcards";
import { getProgress } from "@/lib/progress";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const subjects = listSubjects();
  const due = dueFlashcards();
  const { streak } = getProgress();

  const links = [
    { href: "/chat", label: t("chat"), icon: "chat", color: "bg-blue-500/10 text-blue-600" },
    { href: "/flashcards", label: t("flashcards"), icon: "flashcards", color: "bg-purple-500/10 text-purple-600" },
    { href: "/quizzes", label: t("quizzes"), icon: "quizzes", color: "bg-amber-500/10 text-amber-600" },
    { href: "/exercises", label: t("exercises"), icon: "exercises", color: "bg-green-500/10 text-green-600" },
    { href: "/scan", label: t("scan"), icon: "scan", color: "bg-rose-500/10 text-rose-600" },
    { href: "/progress", label: t("progress"), icon: "progress", color: "bg-cyan-500/10 text-cyan-600" },
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
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${l.color}`}>
                <NavIcon name={l.icon} className="h-5 w-5" />
              </span>
              <span className="font-medium">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
