import { getDb } from "./db";
import { dayKeyInZone, localToday } from "./timezone";

// --- star economy -----------------------------------------------------------
// Stars are derived from real activity so no backfill or extra bookkeeping is
// needed. Each source has a per-event value; a daily cap prevents farming.
// Activity is bucketed by the configured timezone's calendar day, not UTC.

const STAR_VALUE: Record<string, number> = {
  review: 1, // one flashcard review
  quiz: 5, // one quiz attempt
  typed: 3,
  exercise: 3,
  truefalse: 3,
  chat: 1, // one tutor question
  material: 2, // one uploaded material
  lesson: 4, // one lesson built
};
const DAILY_CAP = 120;

interface Event {
  day: string; // local calendar day (YYYY-MM-DD)
  kind: string;
}

function collectEvents(): Event[] {
  const db = getDb();
  const events: Event[] = [];
  const add = (sql: string) => {
    for (const r of db.prepare(sql).all() as { ts: string; kind: string }[]) {
      events.push({ day: dayKeyInZone(r.ts), kind: r.kind });
    }
  };
  add("SELECT reviewed_at ts, 'review' kind FROM review_logs");
  add("SELECT created_at ts, kind FROM activity_attempts");
  add("SELECT created_at ts, 'chat' kind FROM chat_messages WHERE role='user'");
  add("SELECT created_at ts, 'material' kind FROM materials");
  add("SELECT created_at ts, 'lesson' kind FROM lessons");
  return events;
}

/** Monday of the current local week as YYYY-MM-DD. */
function localWeekStart(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export interface StarsSummary {
  weekStart: string;
  today: string;
  weekly: number;
  allTime: number;
  todayStars: number;
  dailyCap: number;
  breakdown: { kind: string; stars: number }[];
}

function starsFor(kind: string): number {
  return STAR_VALUE[kind] ?? 2;
}

export function getStars(): StarsSummary {
  const events = collectEvents();
  const today = localToday();
  const weekStart = localWeekStart(today);

  // Count events per (local day, kind) so the daily cap applies to the total.
  const dayKind = new Map<string, Map<string, number>>();
  for (const e of events) {
    const m = dayKind.get(e.day) ?? new Map<string, number>();
    m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    dayKind.set(e.day, m);
  }

  let allTime = 0;
  let weekly = 0;
  let todayStars = 0;
  const weekByKind = new Map<string, number>();

  for (const [day, kinds] of dayKind) {
    let raw = 0;
    for (const [kind, n] of kinds) raw += n * starsFor(kind);
    const capped = Math.min(raw, DAILY_CAP);
    allTime += capped;
    if (day >= weekStart) weekly += capped;
    if (day === today) todayStars = capped;
    if (day >= weekStart) {
      for (const [kind, n] of kinds) {
        weekByKind.set(kind, (weekByKind.get(kind) ?? 0) + n * starsFor(kind));
      }
    }
  }

  const breakdown = [...weekByKind.entries()]
    .filter(([, v]) => v > 0)
    .map(([kind, stars]) => ({ kind, stars }))
    .sort((a, b) => b.stars - a.stars);

  return {
    weekStart,
    today,
    weekly,
    allTime,
    todayStars,
    dailyCap: DAILY_CAP,
    breakdown,
  };
}

// --- daily challenges -------------------------------------------------------
export interface DailyChallenge {
  id: string;
  current: number;
  target: number;
  done: boolean;
}

export function getDailyChallenges(): DailyChallenge[] {
  const today = localToday();
  const events = collectEvents().filter((e) => e.day === today);

  const reviews = events.filter((e) => e.kind === "review").length;
  const questions = events.filter((e) => e.kind === "chat").length;
  const activities = new Set(
    events
      .filter((e) => e.kind === "quiz" || e.kind === "typed" || e.kind === "exercise" || e.kind === "truefalse")
      .map((e) => e.kind)
  ).size;

  const mk = (id: string, current: number, target: number): DailyChallenge => ({
    id,
    current: Math.min(current, target),
    target,
    done: current >= target,
  });
  return [
    mk("review10", reviews, 10),
    mk("questions3", questions, 3),
    mk("activities2", activities, 2),
  ];
}

// --- weekly league ----------------------------------------------------------
export interface LeagueStatus {
  tier: string;
  nextTier: string | null;
  weekly: number;
  starsToNext: number | null;
}

const TIERS: { name: string; min: number }[] = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 100 },
  { name: "Gold", min: 300 },
  { name: "Diamond", min: 600 },
  { name: "Master", min: 1000 },
];

export function getLeague(weekly: number): LeagueStatus {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (weekly >= TIERS[i].min) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  return {
    tier: tier.name,
    nextTier: next?.name ?? null,
    weekly,
    starsToNext: next ? next.min - weekly : null,
  };
}
