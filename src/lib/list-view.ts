import { formatDayKey, formatDayLabel, formatTimeRange, parseSqliteDate } from "./format";

export interface SourceRef {
  materialId: string;
  filename: string;
  title?: string;
  pageStart?: number;
  pageEnd?: number;
}

export type SortMode = "newest" | "oldest" | "name";
export type GroupMode = "none" | "subject" | "set";

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

export function parseSourceRefs(value: string | null | undefined): SourceRef[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as SourceRef[]) : [];
  } catch {
    return [];
  }
}

export function sourceLabel(source: SourceRef): string {
  const pages =
    source.pageStart && source.pageEnd
      ? source.pageStart === source.pageEnd
        ? `p. ${source.pageStart}`
        : `pp. ${source.pageStart}-${source.pageEnd}`
      : source.pageStart
        ? `p. ${source.pageStart}`
        : "";
  const label = source.title ? `${source.filename} — ${source.title}` : source.filename;
  return [label, pages].filter(Boolean).join(" · ");
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

export interface SetGroup<T> {
  key: string;
  setId: string | null;
  subjectId: string | null;
  subjectName: string;
  color: string | null;
  dayKey: string;
  dayLabel: string;
  timeLabel: string | null;
  items: T[];
}

export function groupItemsBySubjectAndDay<T extends { subject_id: string | null; created_at: string }>(
  items: T[],
  subjects: SubjectOption[],
  locale: string,
  dayOrder: "asc" | "desc" = "desc",
  timeZone?: string
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
        dayLabel: formatDayLabel(dayItems[0].created_at, locale, timeZone),
        timeLabel: formatTimeRange(dayItems.map((item) => item.created_at), locale, timeZone),
        items: dayItems,
      }));

    return { ...group, dayGroups };
  });
}

export function groupItemsBySet<T extends { set_id?: string | null; subject_id: string | null; created_at: string }>(
  items: T[],
  subjects: SubjectOption[],
  locale: string,
  dayOrder: "asc" | "desc" = "desc",
  timeZone?: string
): SetGroup<T>[] {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const dayKey = formatDayKey(item.created_at);
    const key = item.set_id ? `set:${item.set_id}` : `day:${item.subject_id ?? "__none__"}|${dayKey}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([key, groupItems]) => {
      const first = groupItems[0];
      const subject = first.subject_id ? byId.get(first.subject_id) : undefined;
      return {
        key,
        setId: first.set_id ?? null,
        subjectId: first.subject_id ?? null,
        subjectName: subject?.name ?? "—",
        color: subject?.color ?? null,
        dayKey: formatDayKey(first.created_at),
        dayLabel: formatDayLabel(first.created_at, locale, timeZone),
        timeLabel: formatTimeRange(groupItems.map((item) => item.created_at), locale, timeZone),
        items: groupItems,
      };
    })
    .sort((a, b) => {
      const da = parseSqliteDate(a.items[0].created_at).getTime();
      const db = parseSqliteDate(b.items[0].created_at).getTime();
      return dayOrder === "asc" ? da - db : db - da;
    });
}

export function findDuplicateIds<T extends { id: string; subject_id: string | null }>(
  items: T[],
  nameOf: (item: T) => string
): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const item of items) {
    const key = `${item.subject_id ?? ""}|${nameOf(item).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()}`;
    const list = byKey.get(key) ?? [];
    list.push(item.id);
    byKey.set(key, list);
  }
  const dupes = new Set<string>();
  for (const ids of byKey.values()) {
    if (ids.length > 1) {
      for (const id of ids.slice(1)) dupes.add(id);
    }
  }
  return dupes;
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
