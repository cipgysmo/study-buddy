import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`./locales/${locale}.json`)).default;
  return { locale, messages };
});
