import { parseSqliteDate } from "./format";

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
