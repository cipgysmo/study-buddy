"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DeleteButton } from "@/components/subjects/delete-button";
import { ExamPaperCard } from "@/components/subjects/exam-paper-card";
import { MaterialImage } from "@/components/subjects/material-image";
import { MaterialStatus } from "@/components/subjects/material-status";
import type { BoardCard, BoardColumn } from "@/lib/board";

interface MaterialItem {
  id: string;
  filename: string;
  kind: string;
  role: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
  extracted_text: string | null;
  job_id: string | null;
  parse_job_id: string | null;
  topicNames: string[];
  exam?: {
    parseStatus: "none" | "pending" | "running" | "done" | "failed";
    parseError: string | null;
    questionCount: number;
  };
}

function materialColumns(columns: BoardColumn[]): BoardColumn[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => card.material_id),
  }));
}

export function MaterialContainers({
  subjectId,
  initial,
  materials: initialMaterials,
}: {
  subjectId: string;
  initial: BoardColumn[];
  materials: MaterialItem[];
}) {
  const t = useTranslations("Subjects");
  const [columns, setColumns] = useState(() => materialColumns(initial));
  const [materials, setMaterials] = useState(initialMaterials);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [dragOverTray, setDragOverTray] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assignedMaterialIds = new Set(
    columns.flatMap((column) =>
      column.cards.filter((card) => card.material_id).map((card) => card.material_id as string)
    )
  );
  const unassignedMaterials = materials.filter((material) => !assignedMaterialIds.has(material.id));

  function setErrorFromUnknown(err: unknown) {
    setError(err instanceof Error ? err.message : t("boardSaveFailed"));
  }

  function removeMaterialLocal(materialId: string) {
    setMaterials((prev) => prev.filter((material) => material.id !== materialId));
    setColumns((prev) =>
      prev.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => card.material_id !== materialId),
      }))
    );
  }

  async function addColumn() {
    const name = newName.trim();
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
      setColumns((prev) => [...prev, { ...d.column, cards: [] }]);
      setNewName("");
    } catch (err) {
      setErrorFromUnknown(err);
    } finally {
      setBusy(false);
    }
  }

  function startRename(column: BoardColumn) {
    setEditingId(column.id);
    setEditName(column.name);
  }

  async function saveRename(columnId: string) {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/board/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(await r.text());
      setColumns((prev) => prev.map((column) => (column.id === columnId ? { ...column, name } : column)));
      setEditingId(null);
    } catch (err) {
      setErrorFromUnknown(err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteColumn(columnId: string) {
    if (!window.confirm(t("deleteColumn"))) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/board/columns/${columnId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      setColumns((prev) => prev.filter((column) => column.id !== columnId));
    } catch (err) {
      setErrorFromUnknown(err);
    } finally {
      setBusy(false);
    }
  }

  async function assignMaterial(materialId: string, columnId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/board/columns/${columnId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = (await r.json()) as { card: BoardCard };
      setColumns((prev) => {
        const next = materialColumns(prev);
        for (const column of next) {
          column.cards = column.cards.filter((card) => card.id !== d.card.id);
        }
        const target = next.find((column) => column.id === columnId);
        if (target) target.cards.push(d.card);
        return next;
      });
    } catch (err) {
      setErrorFromUnknown(err);
    } finally {
      setBusy(false);
    }
  }

  async function unassignCard(cardId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/board/cards/${cardId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      setColumns((prev) =>
        prev.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.id !== cardId),
        }))
      );
    } catch (err) {
      setErrorFromUnknown(err);
    } finally {
      setBusy(false);
    }
  }

  function cardForMaterial(materialId: string): BoardCard | undefined {
    return columns.flatMap((column) => column.cards).find((card) => card.material_id === materialId);
  }

  function handleDropOnColumn(columnId: string) {
    setDragOverColumnId(null);
    if (draggingMaterialId) void assignMaterial(draggingMaterialId, columnId);
  }

  function handleDropOnTray() {
    setDragOverTray(false);
    if (!draggingMaterialId) return;
    const card = cardForMaterial(draggingMaterialId);
    if (card) void unassignCard(card.id);
  }

  function renderMaterialCard(material: MaterialItem, card?: BoardCard) {
    return (
      <article
        key={material.id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (card) handleDropOnColumn(card.column_id);
        }}
        className="flex items-start gap-2 rounded-xl border border-border bg-background/60 p-2"
      >
        <span
          draggable
          onDragStart={() => setDraggingMaterialId(material.id)}
          onDragEnd={() => {
            setDraggingMaterialId(null);
            setDragOverColumnId(null);
            setDragOverTray(false);
          }}
          title={t("dragMaterialHint")}
          className={
            "mt-1 cursor-grab select-none text-muted active:cursor-grabbing " +
            (draggingMaterialId === material.id ? "opacity-50" : "")
          }
        >
          ⋮⋮
        </span>

        <div className="min-w-0 flex-1">
          {material.role === "exam" && material.exam ? (
            <ExamPaperCard
              material={{
                id: material.id,
                filename: material.filename,
                kind: material.kind,
                status: material.status,
                error: material.error,
                job_id: material.job_id,
                parse_job_id: material.parse_job_id,
              }}
              parseStatus={material.exam.parseStatus}
              parseError={material.exam.parseError}
              questionCount={material.exam.questionCount}
              onDeleted={() => removeMaterialLocal(material.id)}
            />
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              {material.kind === "image" ? (
                <MaterialImage src={`/api/materials/${material.id}`} alt={material.filename} />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/20 text-xs font-semibold uppercase">
                  {material.kind.slice(0, 3)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{material.filename}</span>
                <span className="block truncate text-xs text-muted">
                  {material.status === "failed" && material.error
                    ? material.error
                    : material.kind === "image"
                      ? t("image")
                      : material.extracted_text
                        ? `${material.extracted_text.length} ${t("chars")}`
                        : "—"}
                </span>
                {material.topicNames.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {material.topicNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                      >
                        {name}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <MaterialStatus
                  status={material.status}
                  error={material.error}
                  jobId={material.job_id}
                />
                <DeleteButton
                  href={`/api/materials/${material.id}`}
                  label={t("deleteMaterial")}
                  onDeleted={() => removeMaterialLocal(material.id)}
                />
              </span>
            </div>
          )}
        </div>

        {card && (
          <button
            onClick={() => void unassignCard(card.id)}
            aria-label={t("unassign")}
            title={t("unassign")}
            className="mt-1 shrink-0 text-xs text-muted transition-colors hover:text-red-500"
          >
            ✕
          </button>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("board")}</h3>
        <span className="text-xs text-muted">{t("dragMaterialHint")}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
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
          disabled={busy || !newName.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {t("addColumn")}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverTray(true);
        }}
        onDragLeave={() => setDragOverTray(false)}
        onDrop={(e) => {
          e.preventDefault();
          handleDropOnTray();
        }}
        className={
          "rounded-xl border p-2 transition-colors " +
          (dragOverTray ? "border-accent bg-accent/5" : "border-border")
        }
      >
        <h4 className="mb-2 text-xs font-semibold text-muted">{t("materialsTray")}</h4>
        {unassignedMaterials.length === 0 ? (
          <p className="text-xs text-muted">—</p>
        ) : (
          <div className="space-y-2">
            {unassignedMaterials.map((material) => renderMaterialCard(material))}
          </div>
        )}
      </section>

      {columns.length === 0 ? (
        <p className="text-xs text-muted">{t("noBoardColumns")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                handleDropOnColumn(column.id);
              }}
              className={
                "rounded-xl border p-2 transition-colors " +
                (dragOverColumnId === column.id ? "border-accent bg-accent/5" : "border-border")
              }
            >
              <div className="mb-2 flex items-center gap-2">
                {editingId === column.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveRename(column.id);
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => void saveRename(column.id)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm font-semibold"
                  />
                ) : (
                  <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.name}</h4>
                )}
                <button
                  onClick={() => startRename(column)}
                  aria-label={t("renameCategory")}
                  title={t("renameCategory")}
                  className="shrink-0 text-xs text-muted transition-colors hover:text-accent"
                >
                  ✎
                </button>
                <button
                  onClick={() => void deleteColumn(column.id)}
                  aria-label={t("deleteColumn")}
                  title={t("deleteColumn")}
                  className="shrink-0 text-xs text-muted transition-colors hover:text-red-500"
                >
                  ✕
                </button>
              </div>

              {column.cards.length === 0 ? (
                <p className="text-xs text-muted">—</p>
              ) : (
                <div className="space-y-2">
                  {column.cards.map((card) => {
                    const material = card.material_id
                      ? materials.find((m) => m.id === card.material_id)
                      : undefined;
                    return material ? renderMaterialCard(material, card) : null;
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}