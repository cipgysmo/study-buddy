import { useTranslations } from "next-intl";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function Page() {
  const t = useTranslations("Nav");
  return <PagePlaceholder title={t("settings")} />;
}
