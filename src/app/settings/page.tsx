import { getLocale, getTranslations } from "next-intl/server";
import { CleanupSection } from "@/components/settings/cleanup-section";
import { LanguageSwitcher } from "@/components/settings/language-switcher";
import { NameField } from "@/components/settings/name-field";
import { SoundToggle } from "@/components/settings/sound-toggle";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSetting } from "@/lib/db";
import { getStudentName } from "@/lib/profile";
import { resolveTheme } from "@/lib/theme";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const locale = await getLocale();
  const theme = await resolveTheme();
  const name = getStudentName();
  const sound = (getSetting("sound") ?? "on") as "on" | "off";

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card className="max-w-md space-y-3 p-5">
        <div>
          <h2 className="font-medium">{t("name")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("nameHint")}</p>
        </div>
        <NameField current={name} />
      </Card>

      <Card className="max-w-md space-y-3 p-5">
        <div>
          <h2 className="font-medium">{t("language")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("languageHint")}</p>
        </div>
        <LanguageSwitcher current={locale} />
      </Card>

      <Card className="max-w-md space-y-3 p-5">
        <div>
          <h2 className="font-medium">{t("appearance")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("appearanceHint")}</p>
        </div>
        <ThemeSwitcher current={theme} />
      </Card>

      <Card className="max-w-md p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">{t("sound")}</h2>
            <p className="mt-0.5 text-sm text-muted">{t("soundHint")}</p>
          </div>
          <SoundToggle current={sound} />
        </div>
      </Card>

      <CleanupSection />
    </div>
  );
}
