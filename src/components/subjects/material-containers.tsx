"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteButton } from "@/components/subjects/delete-button";
import { ExamPaperCard } from "@/components/subjects/exam-paper-card";
import { MaterialIconButton } from "@/components/subjects/material-icon-button";
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

function wellClass(active: boolean) {
  return (
    "rounded-xl border p-3 transition-colors " +
    (active ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-border bg-background")
  );
}

function GripIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
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
  const trayDragDepth = useRef(0);
  const columnDragDepth = useRef<Record<string, number>>({});

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

  function resetDragState() {
    setDraggingMaterialId(null);
    setDragOverColumnId(null);
    setDragOverTray(false);
    trayDragDepth.current = 0;
    columnDragDepth.current = {};
  }

  function handleTrayDragEnter(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    trayDragDepth.current += 1;
    setDragOverTray(true);
  }

  function handleTrayDragLeave() {
    trayDragDepth.current = Math.max(0, trayDragDepth.current - 1);
    if (trayDragDepth.current === 0) setDragOverTray(false);
  }

  function handleTrayDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    trayDragDepth.current = 0;
    handleDropOnTray();
  }

  function handleColumnDragEnter(columnId: string, e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    columnDragDepth.current[columnId] = (columnDragDepth.current[columnId] ?? 0) + 1;
    setDragOverColumnId(columnId);
  }

  function handleColumnDragLeave(columnId: string) {
    const next = Math.max(0, (columnDragDepth.current[columnId] ?? 0) - 1);
    columnDragDepth.current[columnId] = next;
    if (next === 0) setDragOverColumnId((id) => (id === columnId ? null : id));
  }

  function handleColumnDrop(columnId: string, e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    columnDragDepth.current[columnId] = 0;
    handleDropOnColumn(columnId);
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
        className={
          "rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/15 " +
          (draggingMaterialId === material.id ? "opacity-40 ring-1 ring-accent/40" : "")
        }
      >
        <div className="flex items-center gap-3">
          <span
            draggable
            onDragStart={() => setDraggingMaterialId(material.id)}
            onDragEnd={resetDragState}
            title={t("dragMaterialHint")}
            className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted transition-colors hover:bg-foreground/5 hover:text-foreground active:cursor-grabbing"
          >
            <GripIcon />
          </span>

          {material.kind === "image" ? (
            <MaterialImage src={`/api/materials/${material.id}`} alt={material.filename} />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-foreground/5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {material.kind.slice(0, 3)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{material.filename}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {material.status === "failed" && material.error
                ? material.error
                : material.kind === "image"
                  ? t("image")
                  : material.extracted_text
                    ? `${material.extracted_text.length} ${t("chars")}`
                    : "—"}
            </span>
            {material.topicNames.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {material.topicNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                  >
                    {name}
                  </span>
                ))}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <MaterialStatus status={material.status} error={material.error} jobId={material.job_id} />
            {card && (
              <MaterialIconButton
                onClick={() => void unassignCard(card.id)}
                aria-label={t("unassign")}
                title={t("unassign")}
              >
                <XIcon />
              </MaterialIconButton>
            )}
            <DeleteButton
              icon
              href={`/api/materials/${material.id}`}
              label={t("deleteMaterial")}
              onDeleted={() => removeMaterialLocal(material.id)}
            />
          </div>
        </div>

        {material.role === "exam" && material.exam && (
          <ExamPaperCard
            material={{
              id: material.id,
              status: material.status,
              parse_job_id: material.parse_job_id,
            }}
            parseStatus={material.exam.parseStatus}
            parseError={material.exam.parseError}
            questionCount={material.exam.questionCount}
          />
        )}
      </article>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{t("board")}</h3>
          <p className="mt-0.5 text-xs text-muted">{t("dragMaterialHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addColumn();
              }
            }}
            placeholder={t("columnPlaceholder")}
            className="w-56 bg-background"
          />
          <Button onClick={() => void addColumn()} disabled={busy || !newName.trim()}>
            {t("addColumn")}
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {error && <p className="text-xs text-danger">{error}</p>}

        <section
          onDragEnter={handleTrayDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleTrayDragLeave}
          onDrop={handleTrayDrop}
          className={wellClass(dragOverTray)}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{t("materialsTray")}</h4>
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
              {unassignedMaterials.length}
            </span>
          </div>
          {unassignedMaterials.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted">
              {t("dropMaterialsHere")}
            </div>
          ) : (
            <div className="space-y-2">
              {unassignedMaterials.map((material) => renderMaterialCard(material))}
            </div>
          )}
        </section>

        {columns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
            {t("noBoardColumns")}
          </div>
        ) : (
          <div className="w-full space-y-2">
            {columns.map((column) => (
              <section
                key={column.id}
                onDragEnter={(e) => handleColumnDragEnter(column.id, e)}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => handleColumnDragLeave(column.id)}
                onDrop={(e) => handleColumnDrop(column.id, e)}
                className={wellClass(dragOverColumnId === column.id)}
              >
                <div className="mb-2 flex items-center gap-2 px-1">
                  {editingId === column.id ? (
                    <Input
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
                      className="max-w-xs bg-card"
                    />
                  ) : (
                    <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.name}</h4>
                  )}
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
                    {column.cards.length}
                  </span>
                  <MaterialIconButton
                    onClick={() => startRename(column)}
                    aria-label={t("renameCategory")}
                    title={t("renameCategory")}
                  >
                    <PencilIcon />
                  </MaterialIconButton>
                  <MaterialIconButton
                    variant="danger"
                    onClick={() => void deleteColumn(column.id)}
                    aria-label={t("deleteColumn")}
                    title={t("deleteColumn")}
                  >
                    <TrashIcon />
                  </MaterialIconButton>
                </div>

                {column.cards.length === 0 ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted">
                    {t("emptyContainer")}
                  </div>
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
    </div>
  );
}
