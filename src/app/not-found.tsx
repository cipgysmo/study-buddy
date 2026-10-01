import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-semibold tracking-tight">404</p>
      <p className="mt-3 text-muted">{t("message")}</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
