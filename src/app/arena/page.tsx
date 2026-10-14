import { getTranslations } from "next-intl/server";
import { listSubjects } from "@/lib/subjects";
import { listModels } from "@/lib/llm";
import { ArenaApp } from "@/components/arena/arena-app";

export default async function ArenaPage() {
  const t = await getTranslations("Arena");
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));
  let models: string[] = [];
  try {
    models = await listModels();
  } catch {
    /* router offline */
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <ArenaApp subjects={subjects} models={models} />
    </div>
  );
}
