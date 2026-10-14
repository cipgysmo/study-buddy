import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listGenerationRequests } from "@/lib/requests";
import { formatDate } from "@/lib/format";
import { getTimezone } from "@/lib/timezone";

function resultHref(type: string, result: string | null): string | null {
  if (!result) return null;
  if (type === "quiz" || type === "similarExam") return `/quizzes/${result}`;
  if (type === "lesson") return `/lessons/${result}`;
  if (type === "plan") return `/exam-prep/${result}`;
  if (type === "exercises" || type === "truefalse" || type === "typedexercises" || type === "practice") {
    return `/practice/${result}`;
  }
  return null;
}

function summarize(payload: Record<string, unknown>): string[] {
  const bits: string[] = [];
  if (typeof payload.count === "number") bits.push(`${payload.count}`);
  if (typeof payload.durationMin === "number") bits.push(`${payload.durationMin} min`);
  if (Array.isArray(payload.topicIds) && payload.topicIds.length) bits.push(`${payload.topicIds.length} topics`);
  if (Array.isArray(payload.columnIds) && payload.columnIds.length) bits.push(`${payload.columnIds.length} containers`);
  if (Array.isArray(payload.keywords) && payload.keywords.length) bits.push(payload.keywords.join(", "));
  if (typeof payload.difficulty === "string") bits.push(payload.difficulty);
  if (typeof payload.customPrompt === "string" && payload.customPrompt.trim()) bits.push(payload.customPrompt.trim());
  return bits;
}

export default async function RequestsPage() {
  const t = await getTranslations("Requests");
  const locale = await getLocale();
  const timezone = getTimezone();
  const requests = listGenerationRequests(100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      {requests.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => {
            const href = resultHref(req.type, req.result);
            return (
              <li key={req.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t(`type_${req.type}`)}</p>
                    <p className="text-xs text-muted">
                      {formatDate(req.created_at, locale, timezone)}
                      {req.subject_name ? ` · ${req.subject_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (req.status === "done"
                          ? "bg-success/10 text-success"
                          : req.status === "failed"
                            ? "bg-danger/10 text-danger"
                            : "bg-foreground/5 text-muted")
                      }
                    >
                      {t(`status_${req.status}`)}
                    </span>
                    {href && (
                      <Link href={href} className="text-xs font-medium text-accent hover:underline">
                        {t("open")}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  {summarize(req.payload).map((bit, i) => (
                    <span key={i} className="rounded-full bg-foreground/5 px-2 py-0.5">
                      {bit}
                    </span>
                  ))}
                </div>
                {req.error && <p className="mt-2 text-xs text-danger">{req.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
