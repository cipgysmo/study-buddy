import type { SortMode } from "./list-view";

export interface PagedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function parseListQuery(params: URLSearchParams) {
  const limit = Math.max(1, Math.min(200, Number(params.get("limit") ?? 100) || 100));
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);
  const sortParam = params.get("sort");
  const sort: SortMode =
    sortParam === "oldest" || sortParam === "name" ? sortParam : "newest";
  const search = params.get("q")?.trim() ?? "";
  const includeArchived = params.get("archived") === "1";
  return { limit, offset, sort, search, includeArchived };
}

export function orderBySql(sort: SortMode, nameColumn: string): string {
  if (sort === "name") return `${nameColumn} COLLATE NOCASE ASC, id ASC`;
  if (sort === "oldest") return "created_at ASC, id ASC";
  return "created_at DESC, id DESC";
}

export function searchSql(columns: string[]): string {
  return columns.map((c) => `lower(${c}) LIKE ?`).join(" OR ");
}

export function pagedResult<T>(items: T[], total: number, limit: number, offset: number): PagedResult<T> {
  return { items, total, limit, offset };
}
