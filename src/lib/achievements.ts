import { getDb } from "./db";
import { getProgress } from "./progress";

/** Aggregate metrics an achievement's condition is evaluated against. */
interface Stats {
  subjects: number;
  materials: number;
  flashcards: number;
  flashcardReps: number;
  quizAttempts: number;
  perfectScores: number;
  chatMessages: number;
  studyPlans: number;
  topics: number;
  activeDays: number;
  bestStreak: number;
}

function computeStats(): Stats {
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get() as { n: number } | undefined)?.n ?? 0;
  return {
    subjects: count("SELECT COUNT(*) n FROM subjects"),
    materials: count("SELECT COUNT(*) n FROM materials"),
    flashcards: count("SELECT COUNT(*) n FROM flashcards"),
    flashcardReps: count("SELECT COALESCE(SUM(reps), 0) n FROM flashcards"),
    quizAttempts: count("SELECT COUNT(*) n FROM quiz_attempts"),
    perfectScores: count("SELECT COUNT(*) n FROM quiz_attempts WHERE total > 0 AND score = total"),
    chatMessages: count("SELECT COUNT(*) n FROM chat_messages WHERE role = 'user'"),
    studyPlans: count("SELECT COUNT(*) n FROM study_plans"),
    topics: count("SELECT COUNT(*) n FROM topics"),
    activeDays: count(
      `SELECT COUNT(DISTINCT day) n FROM (
         SELECT substr(created_at, 1, 10) day FROM chat_messages WHERE role = 'user'
         UNION SELECT substr(taken_at, 1, 10) day FROM quiz_attempts
         UNION SELECT substr(created_at, 1, 10) day FROM flashcards
         UNION SELECT substr(created_at, 1, 10) day FROM materials
       )`
    ),
    bestStreak: getProgress().streak.best,
  };
}

interface Check {
  unlocked: boolean;
  current: number;
  target: number;
}

/** A progress-based condition: unlocked once `current` reaches `target`. */
function toward(value: number, target: number): Check {
  return { unlocked: value >= target, current: Math.min(value, target), target };
}

interface AchievementDef {
  id: string;
  icon: string;
  check: (s: Stats) => Check;
}

const DEFS: AchievementDef[] = [
  { id: "firstSubject", icon: "subjects", check: (s) => toward(s.subjects, 1) },
  { id: "firstMaterial", icon: "scan", check: (s) => toward(s.materials, 1) },
  { id: "library", icon: "library", check: (s) => toward(s.materials, 10) },
  { id: "firstQuiz", icon: "quizzes", check: (s) => toward(s.quizAttempts, 1) },
  { id: "perfectScore", icon: "trophy", check: (s) => toward(s.perfectScores, 1) },
  { id: "quizRegular", icon: "target", check: (s) => toward(s.quizAttempts, 10) },
  { id: "firstCards", icon: "flashcards", check: (s) => toward(s.flashcards, 10) },
  { id: "repeater", icon: "repeat", check: (s) => toward(s.flashcardReps, 50) },
  { id: "checkinFive", icon: "calendar", check: (s) => toward(s.activeDays, 5) },
  { id: "streakThree", icon: "fire", check: (s) => toward(s.bestStreak, 3) },
  { id: "streakSeven", icon: "medal", check: (s) => toward(s.bestStreak, 7) },
  { id: "planner", icon: "examPrep", check: (s) => toward(s.studyPlans, 1) },
  { id: "curious", icon: "chat", check: (s) => toward(s.chatMessages, 20) },
  { id: "organizer", icon: "tag", check: (s) => toward(s.topics, 5) },
];

export interface AchievementStatus {
  id: string;
  icon: string;
  unlocked: boolean;
  current: number;
  target: number;
  unlocked_at: string | null;
}

/** All achievements with their current (recomputed) status and unlock time. */
export function getAchievements(): AchievementStatus[] {
  const s = computeStats();
  const rows = getDb()
    .prepare("SELECT achievement_id, unlocked_at FROM unlocked_achievements")
    .all() as { achievement_id: string; unlocked_at: string }[];
  const unlockedAt = new Map(rows.map((r) => [r.achievement_id, r.unlocked_at]));
  return DEFS.map((def) => {
    const c = def.check(s);
    return {
      id: def.id,
      icon: def.icon,
      unlocked: c.unlocked,
      current: c.current,
      target: c.target,
      unlocked_at: unlockedAt.get(def.id) ?? null,
    };
  });
}

/** Map achievement ids to their display icons (for toasts/banners). */
export function achievementIcons(ids: string[]): { id: string; icon: string }[] {
  const map = new Map(DEFS.map((d) => [d.id, d.icon]));
  return ids.map((id) => ({ id, icon: map.get(id) ?? "trophy" }));
}

/**
 * Persist any achievements that are now earned but not yet recorded. Returns
 * the ids newly unlocked (empty when nothing changed). Idempotent.
 */
export function syncAchievements(): string[] {
  const s = computeStats();
  const db = getDb();
  const existing = new Set(
    (db.prepare("SELECT achievement_id FROM unlocked_achievements").all() as { achievement_id: string }[])
      .map((r) => r.achievement_id)
  );
  const newly: string[] = [];
  const ins = db.prepare("INSERT OR IGNORE INTO unlocked_achievements (achievement_id) VALUES (?)");
  for (const def of DEFS) {
    if (def.check(s).unlocked && !existing.has(def.id)) {
      ins.run(def.id);
      newly.push(def.id);
    }
  }
  return newly;
}
