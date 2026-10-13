import { formatDayKey, formatDayLabel, formatTimeRange, parseSqliteDate } from "./format";

export type SortMode = "newest" | "oldest" | "name";
export type GroupMode = "none" | "subject";

export interface SubjectOption {
  id: string;
  name: string;
  color?: string;
}

export interface GroupedItems<T> {
  subjectId: string | null;
  subjectName: string;
  color: string | null;
  items: T[];
}

export function sortItems<T extends { id: string; created_at: string }>(
  items: T[],
  mode: SortMode,
  nameOf: (item: T) => string,
  locale: string
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (mode === "name") {
      const byName = nameOf(a).localeCompare(nameOf(b), locale, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    }

    const da = parseSqliteDate(a.created_at).getTime();
    const db = parseSqliteDate(b.created_at).getTime();
    if (da !== db) return mode === "oldest" ? da - db : db - da;
    return mode === "oldest" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
  return copy;
}

export interface DayGroup<T> {
  dayKey: string;
  dayLabel: string;
  timeLabel: string | null;
  items: T[];
}

export interface SubjectDayGroup<T> {
  subjectId: string | null;
  subjectName: string;
  color: string | null;
  dayGroups: DayGroup<T>[];
}

export function groupItemsBySubjectAndDay<T extends { subject_id: string | null; created_at: string }>(
  items: T[],
  subjects: SubjectOption[],
  locale: string,
  dayOrder: "asc" | "desc" = "desc"
): SubjectDayGroup<T>[] {
  const subjectGroups = groupItemsBySubject(items, subjects);
  return subjectGroups.map((group) => {
    const byDay = new Map<string, T[]>();
    for (const item of group.items) {
      const key = formatDayKey(item.created_at);
      const list = byDay.get(key) ?? [];
      list.push(item);
      byDay.set(key, list);
    }

    const dayGroups = [...byDay.entries()]
      .sort((a, b) => (dayOrder === "asc" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])))
      .map(([dayKey, dayItems]) => ({
        dayKey,
        dayLabel: formatDayLabel(dayItems[0].created_at, locale),
        timeLabel: formatTimeRange(dayItems.map((item) => item.created_at), locale),
        items: dayItems,
      }));

    return { ...group, dayGroups };
  });
}

export function groupItemsBySubject<T extends { subject_id: string | null }>(
  items: T[],
  subjects: SubjectOption[]
): GroupedItems<T>[] {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const groups = new Map<string, GroupedItems<T>>();

  for (const item of items) {
    const subjectId = item.subject_id;
    const key = subjectId ?? "__none__";
    const subject = subjectId ? byId.get(subjectId) : undefined;
    const group = groups.get(key) ?? {
      subjectId,
      subjectName: subject?.name ?? "—",
      color: subject?.color ?? null,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}
