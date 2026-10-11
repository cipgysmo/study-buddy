import { getTranslations } from "next-intl/server";
import { AdminApp } from "@/components/admin/admin-app";
import { PageHeader } from "@/components/ui/page-header";
import { adminPasswordEnabled } from "@/lib/admin-auth";
import { listAssignments, listStudents, listTemplates } from "@/lib/assignments";
import { getLlmSettings } from "@/lib/llm-settings";
import { listLessons } from "@/lib/lessons";
import { listQuizzes } from "@/lib/quizzes";
import { listSubjects } from "@/lib/subjects";

export default async function AdminPage() {
  const t = await getTranslations("Admin");
  const students = listStudents();
  const subjects = listSubjects();
  const lessons = listLessons();
  const quizzes = listQuizzes();
  const assignments = listAssignments();
  const templates = listTemplates();
  const llmSettings = getLlmSettings();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <AdminApp
        adminPasswordEnabled={adminPasswordEnabled()}
        students={students}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        lessons={lessons.map((l) => ({ id: l.id, subject_id: l.subject_id, title: l.title }))}
        quizzes={quizzes.map((q) => ({
          id: q.id,
          subject_id: q.subject_id,
          title: q.title,
          duration_min: q.duration_min,
        }))}
        assignments={assignments}
        templates={templates}
        llmSettings={llmSettings}
      />
    </div>
  );
}
