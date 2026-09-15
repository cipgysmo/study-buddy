import { useTranslations } from "next-intl";

/**
 * Temporary placeholder for routes whose feature lands in a later phase.
 * Replaced by the real page when that phase is built.
 */
export function PagePlaceholder({ title }: { title: string }) {
  const t = useTranslations("Common");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </header>
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-medium text-accent">{t("comingSoon")}</p>
        <p className="mt-2 text-muted">{t("inDevelopment")}</p>
      </div>
    </div>
  );
}
