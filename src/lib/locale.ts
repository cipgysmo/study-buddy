import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/i18n/languages";
import { getSetting } from "./db";

const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Resolve the active locale for the current request:
 *   cookie (NEXT_LOCALE)  ->  persisted setting (DB)  ->  default (cs)
 * Works in Server Components, Server Actions, and Route Handlers.
 */
export async function resolveLocale(): Promise<Locale> {
  let locale: string | undefined;
  try {
    const cookieStore = await cookies();
    locale = cookieStore.get(LOCALE_COOKIE)?.value;
  } catch {
    locale = undefined;
  }
  if (!locale) {
    locale = getSetting("language") ?? undefined;
  }
  return isSupportedLocale(locale ?? "") ? (locale as Locale) : DEFAULT_LOCALE;
}
