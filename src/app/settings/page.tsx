import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/settings/language-switcher";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <section className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-medium">{t("language")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("languageHint")}</p>
        </div>
        <LanguageSwitcher current={locale} />
      </section>
    </div>
  );
}
