"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { BoardCard, BoardCardKind, BoardColumn } from "@/lib/board";

const KINDS: BoardCardKind[] = ["task", "lesson", "chapter"];

function cloneBoard(columns: BoardColumn[]): BoardColumn[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) => ({ ...card })),
  }));
}

export function SubjectBoard({
  subjectId,
  initial,
}: {
  subjectId: string;
  initial: BoardColumn[];
}) {
  const t = useTranslations("Subjects");
  const [columns, setColumns] = useState(initial);
  const [columnName, setColumnName] = useState("");
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});
  const [cardKinds, setCardKinds] = useState<Record<string, BoardCardKind>>({});
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function persist(next: BoardColumn[]) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/subjects/${subjectId}/board/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: next.map((column) => ({
            id: column.id,
            cards: column.cards.map((card) => ({ id: card.id })),
          })),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch {
      setError(t("boardSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addColumn() {
    const name = columnName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/subjects/${subjectId}/board/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = (await r.json()) as { column: BoardColumn };
      setColumns((prev) => [...prev, d.column]);
      setColumnName("");
    } catch {
      setError(t("boardSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addCard(columnId: string) {
    const title = (cardDrafts[columnId] ?? "").trim();
    if (!title || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/board/columns/${columnId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind: cardKinds[columnId] ?? "task" }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = (await r.json()) as { card: BoardCard };
      setColumns((prev) =>
        prev.map((column) => (column.id === columnId ? { ...column, cards: [...column.cards, d.card] } : column))
      );
      setCardDrafts((prev) => ({ ...prev, [columnId]: "" }));
    } catch {
      setError(t("boardSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeColumn(columnId: string) {
    if (!window.confirm(t("deleteColumn"))) return;
    const next = columns.filter((column) => column.id !== columnId);
    setColumns(next);
    await persist(next);
  }

  async function removeCard(cardId: string) {
    const next = columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => card.id !== cardId),
    }));
    setColumns(next);
    await persist(next);
  }

  function moveCard(cardId: string, targetColumnId: string, beforeCardId?: string) {
    if (busy || cardId === beforeCardId) return;
    const next = cloneBoard(columns);
    let moved: BoardCard | undefined;

    for (const column of next) {
      const index = column.cards.findIndex((card) => card.id === cardId);
      if (index >= 0) {
        moved = column.cards.splice(index, 1)[0];
        break;
      }
    }
    if (!moved) return;

    const target = next.find((column) => column.id === targetColumnId);
    if (!target) return;

    moved.column_id = target.id;
    const beforeIndex = beforeCardId ? target.cards.findIndex((card) => card.id === beforeCardId) : -1;
    if (beforeIndex >= 0) target.cards.splice(beforeIndex, 0, moved);
    else target.cards.push(moved);

    setColumns(next);
    void persist(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={columnName}
          onChange={(e) => setColumnName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addColumn();
            }
          }}
          placeholder={t("columnPlaceholder")}
          className="min-w-56 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={() => void addColumn()}
          disabled={busy || !columnName.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {t("addColumn")}
        </button>
      </div>

      <p className="text-xs text-muted">{t("boardHint")}</p>
      {error && <p className="text-xs text-danger">{error}</p>}

      {columns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted">
          {t("noBoardColumns")}
        </div>
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <section
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumnId(column.id);
              }}
              onDragLeave={() => setDragOverColumnId((id) => (id === column.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColumnId(null);
                if (draggingCardId) moveCard(draggingCardId, column.id);
              }}
              className={
                "min-w-64 rounded-2xl border bg-card p-3 transition-colors " +
                (dragOverColumnId === column.id ? "border-accent bg-accent/5" : "border-border")
              }
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-semibold">{column.name}</h3>
                <button
                  onClick={() => void removeColumn(column.id)}
                  aria-label={t("deleteColumn")}
                  title={t("deleteColumn")}
                  className="shrink-0 text-xs text-muted transition-colors hover:text-red-500"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                {column.cards.map((card) => (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={() => setDraggingCardId(card.id)}
                    onDragEnd={() => {
                      setDraggingCardId(null);
                      setDragOverColumnId(null);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverColumnId(null);
                      if (draggingCardId) moveCard(draggingCardId, column.id, card.id);
                    }}
                    className={
                      "cursor-grab rounded-xl border border-border bg-background/60 p-3 active:cursor-grabbing " +
                      (draggingCardId === card.id ? "opacity-50" : "")
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {card.lesson_id ? (
                          <Link
                            href={`/lessons/${card.lesson_id}`}
                            className="block text-sm font-medium text-accent hover:underline"
                          >
                            {card.title}
                          </Link>
                        ) : (
                          <span className="block text-sm font-medium">{card.title}</span>
                        )}
                        <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {t(`cardKind${card.kind.charAt(0).toUpperCase()}${card.kind.slice(1)}`)}
                        </span>
                      </div>
                      <button
                        onClick={() => void removeCard(card.id)}
                        aria-label={t("deleteCard")}
                        title={t("deleteCard")}
                        className="shrink-0 text-xs text-muted transition-colors hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={cardDrafts[column.id] ?? ""}
                  onChange={(e) => setCardDrafts((prev) => ({ ...prev, [column.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addCard(column.id);
                    }
                  }}
                  placeholder={t("cardPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <select
                  value={cardKinds[column.id] ?? "task"}
                  onChange={(e) => setCardKinds((prev) => ({ ...prev, [column.id]: e.target.value as BoardCardKind }))}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  aria-label={t("cardKind")}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`cardKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void addCard(column.id)}
                  disabled={busy || !(cardDrafts[column.id] ?? "").trim()}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-foreground disabled:opacity-50"
                >
                  {t("addCard")}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}