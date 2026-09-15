export type Locale = "cs" | "en";

export const SUPPORTED_LOCALES: Locale[] = ["cs", "en"];
export const DEFAULT_LOCALE: Locale = "cs";

export interface Language {
  code: Locale;
  /** English name (for tooling / fallbacks) */
  name: string;
  /** Name in the language itself (shown in the picker) */
  nativeName: string;
}

/**
 * Single source of truth for supported languages.
 * To add a new language: add a code to `Locale` + `SUPPORTED_LOCALES`,
 * add an entry here, and drop a `src/i18n/locales/<code>.json` file.
 */
export const LANGUAGES: Language[] = [
  { code: "cs", name: "Czech", nativeName: "Čeština" },
  { code: "en", name: "English", nativeName: "English" },
];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(value);
}
