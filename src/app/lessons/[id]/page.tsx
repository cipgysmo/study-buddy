import { notFound } from "next/navigation";
import { getLesson, listChapters } from "@/lib/lessons";
import { getSubject } from "@/lib/subjects";
import { LessonReader } from "@/components/lessons/lesson-reader";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const subject = getSubject(lesson.subject_id);
  const chapters = listChapters(id);

  return (
    <LessonReader
      lessonId={id}
      initialLesson={lesson}
      initialChapters={chapters}
      subjectColor={subject?.color ?? "#0071e3"}
    />
  );
}
