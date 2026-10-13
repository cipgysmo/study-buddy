export function parseSqliteDate(value: string): Date {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
}

export function formatDate(value: string, locale = "en"): string {
  const date = parseSqliteDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatDayKey(value: string): string {
  const date = parseSqliteDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function formatDayLabel(value: string, locale = "en"): string {
  const date = parseSqliteDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatTimeLabel(value: string, locale = "en"): string {
  const date = parseSqliteDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
}

export function formatTimeRange(values: string[], locale = "en"): string | null {
  const times = values
    .map((value) => ({ value, date: parseSqliteDate(value) }))
    .filter((x) => !Number.isNaN(x.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (times.length < 2) return null;
  const first = formatTimeLabel(times[0].value, locale);
  const last = formatTimeLabel(times[times.length - 1].value, locale);
  return first === last ? null : `${first}–${last}`;
}
