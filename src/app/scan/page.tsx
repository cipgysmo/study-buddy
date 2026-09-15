import { getTranslations } from "next-intl/server";
import { listSubjects } from "@/lib/subjects";
import { ScanApp } from "@/components/scan/scan-app";

export default async function ScanPage() {
  const t = await getTranslations("Scan");
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <ScanApp subjects={subjects} />
    </div>
  );
}
