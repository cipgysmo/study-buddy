"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ModelSettingsSection } from "@/components/admin/model-settings-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Assignment, AssignmentTemplate, Student } from "@/lib/assignments";

type Tab = "assignments" | "templates" | "students" | "models" | "security";
type AssignmentType = Assignment["type"];

interface SubjectOption {
  id: string;
  name: string;
}
interface LessonOption {
  id: string;
  subject_id: string;
  title: string;
}
interface QuizOption {
  id: string;
  subject_id: string;
  title: string;
  duration_min: number | null;
}
interface MaterialOption {
  id: string;
  filename: string;
}
interface TemplateItemDraft {
  key: string;
  type: AssignmentType;
  title: string;
  description: string;
  subjectId: string;
  targetId: string;
  dueOffsetDays: number;
}

const ASSIGNMENT_TYPES: AssignmentType[] = [
  "custom",
  "lesson",
  "quiz",
  "mock_exam",
  "material",
  "flashcards",
  "exercises",
  "truefalse",
  "typed",
];

function typeLabel(t: ReturnType<typeof useTranslations>, type: AssignmentType) {
  const key = `type${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  return t(key);
}

function emptyAssignmentForm() {
  return {
    studentId: "",
    subjectId: "",
    type: "custom" as AssignmentType,
    title: "",
    description: "",
    targetId: "",
    dueAt: "",
  };
}

let templateItemSeq = 0;
function emptyTemplateItem(): TemplateItemDraft {
  return {
    key: `ti-${++templateItemSeq}`,
    type: "custom",
    title: "",
    description: "",
    subjectId: "",
    targetId: "",
    dueOffsetDays: 0,
  };
}

export function AdminApp({
  adminPasswordEnabled,
  students: initialStudents,
  subjects,
  lessons,
  quizzes,
  assignments: initialAssignments,
  templates: initialTemplates,
  llmSettings,
}: {
  adminPasswordEnabled: boolean;
  students: Student[];
  subjects: SubjectOption[];
  lessons: LessonOption[];
  quizzes: QuizOption[];
  assignments: Assignment[];
  templates: AssignmentTemplate[];
  llmSettings: {
    languageEnabled: boolean;
    baseUrl: string;
    model: string;
    apiKeySet: boolean;
    visionEnabled: boolean;
    visionBaseUrl: string;
    visionModel: string;
    visionApiKeySet: boolean;
    effectiveBaseUrl: string;
    effectiveModel: string;
    effectiveVisionBaseUrl: string;
    effectiveVisionModel: string;
  };
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("assignments");
  const [students, setStudents] = useState(initialStudents);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [templates, setTemplates] = useState(initialTemplates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);

  const [studentName, setStudentName] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateItems, setTemplateItems] = useState<TemplateItemDraft[]>([emptyTemplateItem()]);
  const [applyStudentId, setApplyStudentId] = useState("");

  const [adminPassword, setAdminPassword] = useState("");
  const [passwordEnabled, setPasswordEnabled] = useState(adminPasswordEnabled);

  function loadMaterials(subjectId: string) {
    if (!subjectId) {
      setMaterials([]);
      return;
    }
    fetch(`/api/subjects/${subjectId}/materials`)
      .then((r) => r.json())
      .then((d) => setMaterials(d.materials ?? []))
      .catch(() => setMaterials([]));
  }

  async function post(path: string, body?: unknown, method = "POST") {
    const r = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "error");
    return d;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment() {
    await run(async () => {
      const d = await post("/api/admin/assignments", {
        studentId: assignmentForm.studentId || null,
        subjectId: assignmentForm.subjectId || null,
        type: assignmentForm.type,
        title: assignmentForm.title,
        description: assignmentForm.description,
        targetId: assignmentForm.targetId || null,
        dueAt: assignmentForm.dueAt || null,
      });
      setAssignments((prev) => [...prev, d.assignment]);
      setAssignmentForm((prev) => ({ ...prev, title: "", description: "", targetId: "" }));
      setMessage(t("assignmentCreated"));
    });
  }

  async function completeAssignment(id: string) {
    await run(async () => {
      await post(`/api/admin/assignments/${id}`, { status: "done" }, "PATCH");
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "done", completed_at: new Date().toISOString() } : a))
      );
    });
  }

  async function deleteAssignment(id: string) {
    await run(async () => {
      await post(`/api/admin/assignments/${id}`, undefined, "DELETE");
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    });
  }

  async function createStudent() {
    await run(async () => {
      const d = await post("/api/admin/students", { name: studentName });
      setStudents((prev) => [...prev, d.student]);
      setStudentName("");
    });
  }

  async function deleteStudent(id: string) {
    await run(async () => {
      await post(`/api/admin/students/${id}`, undefined, "DELETE");
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setAssignments((prev) => prev.filter((a) => a.student_id !== id));
    });
  }

  async function createTemplate() {
    await run(async () => {
      const d = await post("/api/admin/templates", {
        name: templateName,
        description: templateDescription,
        items: templateItems
          .filter((item) => item.title.trim())
          .map((item) => ({
            type: item.type,
            title: item.title,
            description: item.description,
            subjectId: item.subjectId || null,
            targetId: item.targetId || null,
            dueOffsetDays: item.dueOffsetDays,
          })),
      });
      setTemplates((prev) => [...prev, d.template]);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateItems([emptyTemplateItem()]);
      setMessage(t("templateCreated"));
    });
  }

  async function applyTemplate(id: string) {
    await run(async () => {
      const d = await post(`/api/admin/templates/${id}/apply`, {
        studentId: applyStudentId || null,
      });
      setAssignments((prev) => [...prev, ...d.assignments]);
      setMessage(t("templateApplied"));
    });
  }

  async function deleteTemplate(id: string) {
    await run(async () => {
      await post(`/api/admin/templates/${id}`, undefined, "DELETE");
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    });
  }

  async function saveAdminPassword() {
    await run(async () => {
      await post("/api/admin/security", { password: adminPassword });
      setPasswordEnabled(true);
      setAdminPassword("");
      setMessage(t("passwordSaved"));
    });
  }

  async function clearAdminPassword() {
    await run(async () => {
      await post("/api/admin/security", undefined, "DELETE");
      setPasswordEnabled(false);
      setMessage(t("passwordCleared"));
    });
  }

  function updateTemplateItem(index: number, patch: Partial<TemplateItemDraft>) {
    setTemplateItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  const targetOptions =
    assignmentForm.type === "lesson"
      ? lessons
          .filter((l) => !assignmentForm.subjectId || l.subject_id === assignmentForm.subjectId)
          .map((l) => ({ id: l.id, label: l.title }))
      : assignmentForm.type === "quiz"
        ? quizzes
            .filter((q) => !assignmentForm.subjectId || q.subject_id === assignmentForm.subjectId)
            .map((q) => ({ id: q.id, label: q.title }))
        : assignmentForm.type === "material"
          ? materials.map((m) => ({ id: m.id, label: m.filename }))
          : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "assignments", label: t("assignments") },
    { id: "templates", label: t("templates") },
    { id: "students", label: t("students") },
    { id: "models", label: t("modelSettings") },
    { id: "security", label: t("security") },
  ];

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap rounded-xl border border-border bg-card p-1 shadow-soft">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={
              "min-h-8 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (tab === x.id
                ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                : "text-muted hover:text-foreground")
            }
          >
            {x.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-muted">{message}</p>}

      {tab === "assignments" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="space-y-3 p-5">
            <h2 className="font-medium">{t("newAssignment")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-xs font-medium text-muted">{t("student")}</span>
                <Select
                  value={assignmentForm.studentId}
                  onChange={(e) =>
                    setAssignmentForm((prev) => ({ ...prev, studentId: e.target.value }))
                  }
                >
                  <option value="">{t("allStudents")}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-muted">{t("subject")}</span>
                <Select
                  value={assignmentForm.subjectId}
                  onChange={(e) => {
                    const subjectId = e.target.value;
                    setAssignmentForm((prev) => ({ ...prev, subjectId, targetId: "" }));
                    if (assignmentForm.type === "material") loadMaterials(subjectId);
                  }}
                >
                  <option value="">{t("noSubject")}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-muted">{t("type")}</span>
                <Select
                  value={assignmentForm.type}
                  onChange={(e) => {
                    const type = e.target.value as AssignmentType;
                    setAssignmentForm((prev) => ({ ...prev, type, targetId: "" }));
                    if (type === "material") loadMaterials(assignmentForm.subjectId);
                    else setMaterials([]);
                  }}
                >
                  {ASSIGNMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(t, type)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-muted">{t("dueDate")}</span>
                <Input
                  type="date"
                  value={assignmentForm.dueAt}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, dueAt: e.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-muted">{t("title")}</span>
              <Input
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            {targetOptions.length > 0 && (
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-muted">{t("target")}</span>
                <Select
                  value={assignmentForm.targetId}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, targetId: e.target.value }))}
                >
                  <option value="">{t("noTarget")}</option>
                  {targetOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-muted">{t("description")}</span>
              <textarea
                value={assignmentForm.description}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
              />
            </label>
            <Button onClick={() => void createAssignment()} disabled={busy || !assignmentForm.title.trim()}>
              {t("createAssignment")}
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-medium">{t("assignments")}</h2>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted">{t("noAssignments")}</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{a.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {a.student_name ?? t("allStudents")} · {typeLabel(t, a.type)}
                          {a.due_at ? ` · ${a.due_at}` : ""}
                          {a.status === "done" ? ` · ${t("done")}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {a.status !== "done" && (
                          <Button variant="ghost" size="sm" onClick={() => void completeAssignment(a.id)}>
                            {t("markDone")}
                          </Button>
                        )}
                        <Button variant="danger" size="sm" onClick={() => void deleteAssignment(a.id)}>
                          {t("delete")}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card className="space-y-3 p-5">
            <h2 className="font-medium">{t("newTemplate")}</h2>
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-muted">{t("templateName")}</span>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-muted">{t("description")}</span>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">{t("sequence")}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTemplateItems((prev) => [...prev, emptyTemplateItem()])}
                >
                  {t("addItem")}
                </Button>
              </div>
              {templateItems.map((item, index) => (
                <div key={item.key} className="rounded-xl border border-border bg-background p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={item.type}
                      onChange={(e) => updateTemplateItem(index, { type: e.target.value as AssignmentType })}
                    >
                      {ASSIGNMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {typeLabel(t, type)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={item.title}
                      placeholder={t("title")}
                      onChange={(e) => updateTemplateItem(index, { title: e.target.value })}
                    />
                    <Select
                      value={item.subjectId}
                      onChange={(e) => updateTemplateItem(index, { subjectId: e.target.value, targetId: "" })}
                    >
                      <option value="">{t("noSubject")}</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={item.dueOffsetDays}
                      onChange={(e) =>
                        updateTemplateItem(index, { dueOffsetDays: Number(e.target.value) || 0 })
                      }
                    />
                    <textarea
                      value={item.description}
                      placeholder={t("description")}
                      onChange={(e) => updateTemplateItem(index, { description: e.target.value })}
                      rows={2}
                      className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring sm:col-span-2"
                    />
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-2"
                    onClick={() => setTemplateItems((prev) => prev.filter((_, i) => i !== index))}
                  >
                    {t("removeItem")}
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={() => void createTemplate()} disabled={busy || !templateName.trim()}>
              {t("createTemplate")}
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-medium">{t("templates")}</h2>
            {templates.length === 0 ? (
              <p className="text-sm text-muted">{t("noTemplates")}</p>
            ) : (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li key={tpl.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{tpl.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {t("sequenceItems", { count: tpl.items.length })}
                        </p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => void deleteTemplate(tpl.id)}>
                        {t("delete")}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select value={applyStudentId} onChange={(e) => setApplyStudentId(e.target.value)}>
                        <option value="">{t("allStudents")}</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                      <Button size="sm" onClick={() => void applyTemplate(tpl.id)} disabled={busy}>
                        {t("applyTemplate")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "students" && (
        <Card className="max-w-xl space-y-3 p-5">
          <h2 className="font-medium">{t("students")}</h2>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder={t("studentName")}
              className="min-w-52"
            />
            <Button onClick={() => void createStudent()} disabled={busy || !studentName.trim()}>
              {t("addStudent")}
            </Button>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-muted">{t("noStudents")}</p>
          ) : (
            <ul className="space-y-2">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                  <span className="font-medium">{s.name}</span>
                  <Button variant="danger" size="sm" onClick={() => void deleteStudent(s.id)}>
                    {t("delete")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "models" && <ModelSettingsSection current={llmSettings} />}

      {tab === "security" && (
        <Card className="max-w-xl space-y-3 p-5">
          <h2 className="font-medium">{t("security")}</h2>
          <p className="text-sm text-muted">{t("securityHint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder={t("password")}
              className="min-w-52"
            />
            <Button onClick={() => void saveAdminPassword()} disabled={busy || !adminPassword.trim()}>
              {passwordEnabled ? t("changePassword") : t("enablePassword")}
            </Button>
            {passwordEnabled && (
              <Button variant="danger" onClick={() => void clearAdminPassword()} disabled={busy}>
                {t("disablePassword")}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted">
            {passwordEnabled ? t("passwordEnabled") : t("passwordDisabled")}
          </p>
        </Card>
      )}
    </div>
  );
}
