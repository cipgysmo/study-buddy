import { getSetting, setSetting } from "./db";

export function getTimezone(): string {
  const stored = getSetting("timezone");
  if (stored) return stored;
  return process.env.TZ || "UTC";
}

export function setTimezone(timeZone: string): void {
  setSetting("timezone", timeZone.trim());
}

/** Format a Date as YYYY-MM-DD in the given timezone (en-CA gives ISO order). */
function fmtDay(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Public: format a Date as a local YYYY-MM-DD day label. */
export function dayLabel(d: Date, timeZone = getTimezone()): string {
  return fmtDay(d, timeZone);
}

/** Today's calendar date (YYYY-MM-DD) in the configured timezone. */
export function localToday(timeZone = getTimezone()): string {
  return fmtDay(new Date(), timeZone);
}

/**
 * Convert a stored UTC timestamp ("YYYY-MM-DD HH:MM:SS" or ISO) to the local
 * calendar day (YYYY-MM-DD) in the configured timezone. Used for streaks,
 * stars, and "due today" so late-evening activity counts on the right day.
 */
export function dayKeyInZone(utcStr: string, timeZone = getTimezone()): string {
  if (!utcStr) return utcStr;
  const iso = utcStr.includes("T") ? utcStr : `${utcStr.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return utcStr.slice(0, 10);
  return fmtDay(d, timeZone);
}

/** The last n local calendar day labels (oldest first) in the configured timezone. */
export function lastNDaysLocal(n: number, timeZone = getTimezone()): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(fmtDay(new Date(now.getTime() - i * 86_400_000), timeZone));
  }
  return out;
}
