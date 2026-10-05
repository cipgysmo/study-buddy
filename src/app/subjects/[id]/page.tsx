import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSubject, listMaterials } from "@/lib/subjects";
import { listTopics, materialTopicNames } from "@/lib/topics";
import { listBoard } from "@/lib/board";
import { getJob } from "@/lib/jobs";
import { countExamQuestions } from "@/lib/exams";
import { UploadMaterialForm } from "@/components/subjects/upload-material-form";
import { DeleteButton } from "@/components/subjects/delete-button";
import { MaterialImage } from "@/components/subjects/material-image";
import { MaterialStatus } from "@/components/subjects/material-status";
import { TopicManager } from "@/components/subjects/topic-manager";
import { RetagTopicsButton } from "@/components/subjects/retag-topics-button";
import { ExamPaperCard } from "@/components/subjects/exam-paper-card";
import { SubjectBoard } from "@/components/subjects/subject-board";
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
  const materials = listMaterials(id);
  const topics = listTopics(id);
  const board = listBoard(id);
  const topicTags = materialTopicNames(
    materials.filter((m) => m.role === "notes").map((m) => m.id)
  );

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
        <h2 className="text-lg font-semibold">{t("board")}</h2>
        <SubjectBoard
          subjectId={id}
          initial={board}
          materials={materials.map((m) => ({
            id: m.id,
            filename: m.filename,
            kind: m.kind,
            role: m.role,
            status: m.status,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("materials")}</h2>
        <UploadMaterialForm subjectId={id} />
        {materials.length === 0 ? (
          <p className="text-sm text-muted">{t("noMaterials")}</p>
        ) : (
          <ul className="space-y-2">
            {materials.map((m) => {
              if (m.role === "exam") {
                const parseJob = m.parse_job_id ? getJob(m.parse_job_id) : null;
                const parseStatus = parseJob ? parseJob.status : "none";
                return (
                  <li key={m.id}>
                    <ExamPaperCard
                      material={{
                        id: m.id,
                        filename: m.filename,
                        kind: m.kind,
                        status: m.status,
                        error: m.error,
                        job_id: m.job_id,
                        parse_job_id: m.parse_job_id,
                      }}
                      parseStatus={parseStatus}
                      parseError={parseJob?.error ?? null}
                      questionCount={countExamQuestions(m.id)}
                    />
                  </li>
                );
              }
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {m.kind === "image" && (
                      <MaterialImage src={`/api/materials/${m.id}`} alt={m.filename} />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.filename}</span>
                      <span className="block truncate text-xs text-muted">
                        {m.status === "failed" && m.error
                          ? m.error
                          : m.kind === "image"
                            ? t("image")
                            : m.extracted_text
                              ? `${m.extracted_text.length} ${t("chars")}`
                              : "—"}
                      </span>
                      {topicTags.get(m.id)?.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {topicTags.get(m.id)!.map((name) => (
                            <span
                              key={name}
                              className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                            >
                              {name}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <MaterialStatus status={m.status} error={m.error} jobId={m.job_id} />
                    <DeleteButton href={`/api/materials/${m.id}`} label={t("deleteMaterial")} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
