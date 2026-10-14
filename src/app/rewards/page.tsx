import { getTranslations } from "next-intl/server";
import { getDailyChallenges, getLeague, getStars } from "@/lib/gamification";

export default async function RewardsPage() {
  const t = await getTranslations("Rewards");
  const stars = getStars();
  const challenges = getDailyChallenges();
  const league = getLeague(stars.weekly);

  const kindLabel: Record<string, string> = {
    review: t("kindReview"),
    quiz: t("kindQuiz"),
    typed: t("kindTyped"),
    exercise: t("kindExercise"),
    truefalse: t("kindTrueFalse"),
    chat: t("kindChat"),
    material: t("kindMaterial"),
    lesson: t("kindLesson"),
  };
  const challengeLabel: Record<string, string> = {
    review10: t("challengeReview"),
    questions3: t("challengeQuestions"),
    activities2: t("challengeActivities"),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm text-muted">{t("weekly")}</div>
          <div className="mt-1 text-3xl font-semibold">⭐ {stars.weekly}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm text-muted">{t("today")}</div>
          <div className="mt-1 text-3xl font-semibold">
            {stars.todayStars}
            <span className="text-base text-muted"> / {stars.dailyCap}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm text-muted">{t("league")}</div>
          <div className="mt-1 text-3xl font-semibold">{league.tier}</div>
          {league.starsToNext != null && (
            <div className="mt-1 text-xs text-muted">
              {league.starsToNext} → {league.nextTier}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("dailyChallenges")}</h2>
        <ul className="space-y-3">
          {challenges.map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className={c.done ? "text-accent" : ""}>
                  {c.done ? "✓ " : ""}
                  {challengeLabel[c.id] ?? c.id}
                </span>
                <span className="text-muted">
                  {c.current}/{c.target}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, (c.current / c.target) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("weeklyBreakdown")}</h2>
        {stars.breakdown.length === 0 ? (
          <p className="text-sm text-muted">{t("noActivity")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stars.breakdown.map((b) => (
              <li key={b.kind} className="flex items-center justify-between">
                <span>{kindLabel[b.kind] ?? b.kind}</span>
                <span className="text-muted">⭐ {b.stars}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
