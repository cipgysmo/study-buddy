import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/shell/nav-icons";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { dueFlashcards } from "@/lib/flashcards";
import { listActiveJobs } from "@/lib/jobs";
import { getProgress } from "@/lib/progress";
import { getStudentName } from "@/lib/profile";
import { listSubjects } from "@/lib/subjects";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const subjects = listSubjects();
  const due = dueFlashcards();
  const activeJobs = listActiveJobs();
  const { streak } = getProgress();
  const name = getStudentName();

  const primaryAction =
    due.length > 0
      ? {
          href: "/flashcards",
          title: t("reviewDue"),
          hint: t("reviewDueHint", { count: due.length }),
          icon: "flashcards",
        }
      : subjects.length > 0
        ? {
            href: "/subjects",
            title: t("startStudying"),
            hint: t("startStudyingHint"),
            icon: "subjects",
          }
        : {
            href: "/subjects",
            title: t("createFirstSubject"),
            hint: t("createFirstSubjectHint"),
            icon: "subjects",
          };

  const quickActions = [
    { href: "/chat", label: t("chat"), icon: "chat" },
    { href: "/scan", label: t("scan"), icon: "scan" },
    { href: "/quizzes", label: t("quizzes"), icon: "quizzes" },
    { href: "/exercises", label: t("exercises"), icon: "exercises" },
    { href: "/exam-prep", label: t("examPrep"), icon: "examPrep" },
    { href: "/progress", label: t("progress"), icon: "progress" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("today")}
        title={name ? t("greetingWithName", { name }) : t("greeting")}
        description={t("subtitle")}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("due")}
          value={due.length}
          hint={due.length > 0 ? undefined : t("noDueHint")}
          icon={<NavIcon name="flashcards" className="h-5 w-5" />}
        />
        <StatCard
          label={t("streak")}
          value={streak.current}
          hint={t("streakHint")}
          icon={<NavIcon name="fire" className="h-5 w-5" />}
        />
        <StatCard
          label={t("subjects")}
          value={subjects.length}
          hint={t("subjectsHint")}
          icon={<NavIcon name="subjects" className="h-5 w-5" />}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <NavIcon name={primaryAction.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{primaryAction.title}</h2>
              <p className="mt-1 text-sm text-muted">{primaryAction.hint}</p>
              {activeJobs.length > 0 && (
                <p className="mt-2 text-xs text-accent">
                  {activeJobs.length} job{activeJobs.length === 1 ? "" : "s"} processing…
                </p>
              )}
            </div>
          </div>
          <Link
            href={primaryAction.href}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-soft transition hover:opacity-90"
          >
            {primaryAction.title}
          </Link>
        </div>
      </section>

      {subjects.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">{t("recentSubjects")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.slice(0, 4).map((subject) => {
              const subjectDue = dueFlashcards(subject.id).length;
              return (
                <Link
                  key={subject.id}
                  href={`/subjects/${subject.id}`}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{subject.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {t("materialsCount", { count: subject.materialCount })}
                          {subjectDue > 0 && ` · ${t("dueCards", { count: subjectDue })}`}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm text-accent">{t("openSubject")}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">{t("quickActions")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-foreground">
                <NavIcon name={action.icon} className="h-5 w-5" />
              </span>
              <span className="font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
