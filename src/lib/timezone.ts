import { getSetting, setSetting } from "./db";

export function getTimezone(): string {
  const stored = getSetting("timezone");
  if (stored) return stored;
  return process.env.TZ || "UTC";
}

export function setTimezone(timeZone: string): void {
  setSetting("timezone", timeZone.trim());
}
