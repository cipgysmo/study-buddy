import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/shell/nav-icons";
import { BuildLessonButton } from "@/components/lessons/build-lesson-button";
import { MaterialContainers } from "@/components/subjects/material-containers";
import { RetagTopicsButton } from "@/components/subjects/retag-topics-button";
import { TopicManager } from "@/components/subjects/topic-manager";
import { UploadMaterialForm } from "@/components/subjects/upload-material-form";
import { Card } from "@/components/ui/card";
import { countExamQuestions } from "@/lib/exams";
import { dueFlashcards } from "@/lib/flashcards";
import { listBoard } from "@/lib/board";
import { getJob } from "@/lib/jobs";
import { getSubject, listMaterials, listSubjects } from "@/lib/subjects";
import { listTopics, materialTopicNames } from "@/lib/topics";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("Subjects");
  const { id } = await params;
  const subject = getSubject(id);
  if (!subject) notFound();
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));
  const materials = listMaterials(id);
  const topics = listTopics(id);
  const board = listBoard(id);
  const due = dueFlashcards(id).length;
  const topicTags = materialTopicNames(
    materials.filter((m) => m.role === "notes").map((m) => m.id)
  );
  const materialItems = materials.map((m) => {
    const parseJob = m.parse_job_id ? getJob(m.parse_job_id) : null;
    return {
      id: m.id,
      filename: m.filename,
      kind: m.kind,
      role: m.role,
      status: m.status,
      error: m.error,
      extracted_text: m.extracted_text,
      job_id: m.job_id,
      parse_job_id: m.parse_job_id,
      created_at: m.created_at,
      topicNames: topicTags.get(m.id) ?? [],
      exam:
        m.role === "exam"
          ? {
              parseStatus: parseJob ? parseJob.status : ("none" as const),
              parseError: parseJob?.error ?? null,
              questionCount: countExamQuestions(m.id),
            }
          : undefined,
    };
  });

  const actions = [
    { href: `/flashcards?subject=${id}`, label: t("practiceFlashcards"), icon: "flashcards" },
    { href: `/quizzes?subject=${id}`, label: t("practiceQuizzes"), icon: "quizzes" },
    { href: `/exercises?subject=${id}`, label: t("practiceExercises"), icon: "exercises" },
    { href: "/scan", label: t("scanMaterial"), icon: "scan" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/subjects" className="text-sm text-muted hover:text-foreground">
        {t("backToSubjects")}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="mt-1 h-10 w-10 shrink-0 rounded-2xl"
            style={{ backgroundColor: subject.color }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent">{t("workspace")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {subject.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t("materialsCount", { count: subject.materialCount })}
              {due > 0 && ` · ${t("dueCards", { count: due })}`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium shadow-soft transition hover:border-accent hover:text-accent"
            >
              <NavIcon name={action.icon} className="h-4 w-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted">{t("topics")}</p>
          <p className="mt-1 text-2xl font-semibold">{topics.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">{t("materials")}</p>
          <p className="mt-1 text-2xl font-semibold">{materials.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">{t("board")}</p>
          <p className="mt-1 text-2xl font-semibold">{board.length}</p>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("guidedLesson")}</h2>
        <BuildLessonButton subjectId={id} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("topics")}</h2>
          <RetagTopicsButton subjectId={id} />
        </div>
        <Card className="p-4">
          <TopicManager
            subjectId={id}
            initial={topics.map((x) => ({ id: x.id, name: x.name }))}
          />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("materials")}</h2>
        <UploadMaterialForm
          subjectId={id}
          containers={board.map((column) => ({ id: column.id, name: column.name }))}
        />
        <MaterialContainers
          key={materialItems.map((m) => m.id).join(",")}
          subjectId={id}
          subjects={subjects}
          initial={board}
          materials={materialItems}
        />
      </section>
    </div>
  );
}
