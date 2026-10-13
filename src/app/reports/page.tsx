import { getTranslations } from "next-intl/server";
import { getSkillReport, type ReportArea } from "@/lib/attempts";

function accuracyClass(area: ReportArea): string {
  const score = area.avgScore ?? area.accuracy ?? 0;
  if (score >= 85) return "bg-success/15 text-success border-success/20";
  if (score >= 70) return "bg-accent/10 text-accent border-accent/20";
  if (score >= 50) return "bg-warning/15 text-warning border-warning/20";
  return "bg-danger/10 text-danger border-danger/20";
}

function AreaList({ title, areas, empty }: { title: string; areas: ReportArea[]; empty: string }) {
  if (areas.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted">{empty}</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {areas.map((area) => (
          <div
            key={`${area.kind}-${area.id}`}
            className={`rounded-xl border px-3 py-2 ${accuracyClass(area)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{area.name}</span>
              <span className="shrink-0 text-xs font-semibold">
                {area.avgScore ?? area.accuracy ?? 0}%
              </span>
            </div>
            <div className="mt-1 text-xs opacity-80">
              {area.correct} correct · {area.incorrect} incorrect · {area.attempts} attempts
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-current opacity-70"
                style={{ width: `${Math.max(0, Math.min(100, area.avgScore ?? area.accuracy ?? 0))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const t = await getTranslations("Reports");
  const { subject } = await searchParams;
  const report = getSkillReport(subject);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-success/20 bg-success/15 px-2 py-1 text-success">{t("strong")}</span>
        <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-1 text-accent">{t("good")}</span>
        <span className="rounded-full border border-warning/20 bg-warning/15 px-2 py-1 text-warning">{t("developing")}</span>
        <span className="rounded-full border border-danger/20 bg-danger/10 px-2 py-1 text-danger">{t("weak")}</span>
      </div>

      <AreaList title={t("topics")} areas={report.topics} empty={t("emptyTopics")} />
      <AreaList title={t("containers")} areas={report.containers} empty={t("emptyContainers")} />
    </div>
  );
}
