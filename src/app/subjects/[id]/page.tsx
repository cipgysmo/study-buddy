import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSubject, listMaterials, listSubjects } from "@/lib/subjects";
import { listTopics, materialTopicNames } from "@/lib/topics";
import { listBoard } from "@/lib/board";
import { getJob } from "@/lib/jobs";
import { countExamQuestions } from "@/lib/exams";
import { UploadMaterialForm } from "@/components/subjects/upload-material-form";
import { TopicManager } from "@/components/subjects/topic-manager";
import { RetagTopicsButton } from "@/components/subjects/retag-topics-button";
import { MaterialContainers } from "@/components/subjects/material-containers";
import { BuildLessonButton } from "@/components/lessons/build-lesson-button";

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

  return (
    <div className="space-y-6">
      <Link href="/subjects" className="text-sm text-muted hover:text-foreground">
        {t("backToSubjects")}
      </Link>

      <header className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: subject.color }} />
        <h1 className="text-3xl font-semibold tracking-tight">{subject.name}</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("topics")}</h2>
        <TopicManager
          subjectId={id}
          initial={topics.map((x) => ({ id: x.id, name: x.name }))}
        />
        <RetagTopicsButton subjectId={id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("guidedLesson")}</h2>
        <BuildLessonButton subjectId={id} />
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
