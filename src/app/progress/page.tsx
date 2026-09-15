import { getTranslations } from "next-intl/server";
import { getProgress } from "@/lib/progress";

export default async function ProgressPage() {
  const t = await getTranslations("Progress");
  const data = getProgress();
  const maxActivity = Math.max(1, ...data.activity.map((a) => a.count));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("subjects")} value={data.totals.subjects} />
        <Stat label={t("materials")} value={data.totals.materials} />
        <Stat label={t("flashcards")} value={data.totals.flashcards} />
        <Stat label={t("quizzes")} value={data.totals.quizzes} />
        <Stat label={t("attempts")} value={data.totals.quizAttempts} />
        <Stat label={t("messages")} value={data.totals.chatMessages} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-medium text-muted">{t("activity")}</h2>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.activity.map((a) => (
              <div key={a.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-accent/70"
                  style={{
                    height: `${(a.count / maxActivity) * 100}%`,
                    minHeight: a.count ? "4px" : "0",
                  }}
                  title={`${a.date}: ${a.count}`}
                />
                <span className="text-[10px] text-muted">{a.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted">{t("streak")}</h2>
          <p className="mt-2 text-4xl font-semibold">{data.streak.current}</p>
          <p className="text-sm text-muted">{t("days")}</p>
          <p className="mt-4 text-sm text-muted">
            {t("bestStreak")}: <span className="font-medium text-foreground">{data.streak.best}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted">{t("mastery")}</h2>
        {data.mastery.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("noActivity")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.mastery.map((m) => (
              <div key={m.subjectId}>
                <div className="flex justify-between text-sm">
                  <span>{m.name}</span>
                  <span className="text-muted">{m.score}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-foreground/10">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${m.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
