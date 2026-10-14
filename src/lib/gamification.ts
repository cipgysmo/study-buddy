import { getDb } from "./db";

// --- star economy -----------------------------------------------------------
// Stars are derived from real activity so no backfill or extra bookkeeping is
// needed. Each source has a per-event value; a daily cap prevents farming.

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

function isoWeekStart(now = new Date()): string {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

interface DayRow {
  day: string;
  kind: string;
  n: number;
}

function collectDayRows(): DayRow[] {
  const db = getDb();
  const rows: DayRow[] = [];
  const add = (sql: string) => {
    for (const r of db.prepare(sql).all() as { day: string; kind: string; n: number }[]) {
      rows.push({ day: r.day, kind: r.kind, n: r.n });
    }
  };
  add(
    "SELECT substr(reviewed_at,1,10) day, 'review' kind, COUNT(*) n FROM review_logs GROUP BY day"
  );
  add(
    "SELECT substr(created_at,1,10) day, kind, COUNT(*) n FROM activity_attempts GROUP BY day, kind"
  );
  add(
    "SELECT substr(created_at,1,10) day, 'chat' kind, COUNT(*) n FROM chat_messages WHERE role='user' GROUP BY day"
  );
  add("SELECT substr(created_at,1,10) day, 'material' kind, COUNT(*) n FROM materials GROUP BY day");
  add("SELECT substr(created_at,1,10) day, 'lesson' kind, COUNT(*) n FROM lessons GROUP BY day");
  return rows;
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

function starsFor(kind: string, n: number): number {
  return n * (STAR_VALUE[kind] ?? 2);
}

export function getStars(): StarsSummary {
  const rows = collectDayRows();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = isoWeekStart();

  // Group by day so the daily cap can be applied to the summed total.
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const stars = starsFor(r.kind, r.n);
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + stars);
  }
  let allTime = 0;
  let weekly = 0;
  let todayStars = 0;
  for (const [day, raw] of byDay) {
    const capped = Math.min(raw, DAILY_CAP);
    allTime += capped;
    if (day >= weekStart) weekly += capped;
    if (day === today) todayStars = capped;
  }

  // Weekly breakdown by kind (uncapped per kind; informational only).
  const weekByKind = new Map<string, number>();
  for (const r of rows) {
    if (r.day < weekStart) continue;
    weekByKind.set(r.kind, (weekByKind.get(r.kind) ?? 0) + starsFor(r.kind, r.n));
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
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const one = (sql: string) => (db.prepare(sql).get(today) as { n: number } | undefined)?.n ?? 0;

  const reviews = one("SELECT COUNT(*) n FROM review_logs WHERE substr(reviewed_at,1,10)=?");
  const questions = one(
    "SELECT COUNT(*) n FROM chat_messages WHERE role='user' AND substr(created_at,1,10)=?"
  );
  const activities = one(
    "SELECT COUNT(DISTINCT kind) n FROM activity_attempts WHERE substr(created_at,1,10)=?"
  );

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
