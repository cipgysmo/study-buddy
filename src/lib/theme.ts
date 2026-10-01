import { cookies } from "next/headers";
import { getSetting, setSetting } from "./db";

export type Theme = "system" | "light" | "dark";

const THEME_COOKIE = "THEME";

export function isSupportedTheme(v: string): v is Theme {
  return v === "system" || v === "light" || v === "dark";
}

/** Resolve the theme for the current request: cookie -> persisted setting -> system. */
export async function resolveTheme(): Promise<Theme> {
  let theme: string | undefined;
  try {
    const cookieStore = await cookies();
    theme = cookieStore.get(THEME_COOKIE)?.value;
  } catch {
    theme = undefined;
  }
  if (!theme) {
    theme = getSetting("theme") ?? undefined;
  }
  return isSupportedTheme(theme ?? "") ? (theme as Theme) : "system";
}

/** Persist a theme choice: cookie (this browser) + DB (across devices). */
export async function setTheme(theme: Theme): Promise<void> {
  setSetting("theme", theme);
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
  });
}
