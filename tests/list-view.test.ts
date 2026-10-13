import { describe, expect, it } from "vitest";
import { groupItemsBySubject, sortItems } from "@/lib/list-view";

const items = [
  { id: "b", subject_id: "s2", created_at: "2026-01-02 10:00:00", title: "Beta" },
  { id: "a", subject_id: "s1", created_at: "2026-01-01 10:00:00", title: "Alpha" },
  { id: "c", subject_id: "s1", created_at: "2026-01-03 10:00:00", title: "Charlie" },
];

describe("list view helpers", () => {
  it("sorts by newest, oldest, and name", () => {
    expect(sortItems(items, "newest", (item) => item.title, "en").map((x) => x.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(sortItems(items, "oldest", (item) => item.title, "en").map((x) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortItems(items, "name", (item) => item.title, "en").map((x) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("groups items by subject", () => {
    const groups = groupItemsBySubject(items, [
      { id: "s1", name: "Math", color: "#000" },
      { id: "s2", name: "Physics", color: "#fff" },
    ]);
    expect(groups.map((g) => g.subjectName)).toEqual(["Math", "Physics"]);
    expect(groups[0].items.map((x) => x.id)).toEqual(["a", "c"]);
  });
});
