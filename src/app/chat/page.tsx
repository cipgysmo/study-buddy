import { getTranslations } from "next-intl/server";
import { listSessions } from "@/lib/chat";
import { listSubjects } from "@/lib/subjects";
import { ChatApp } from "@/components/chat/chat-app";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ChatPage(props: PageProps<"/chat">) {
  const t = await getTranslations("Chat");
  const params = await props.searchParams;
  const sessions = listSessions();
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

  const initialSubjectId = first(params.subjectId) ?? "";
  const initialTopicIds = Array.isArray(params.topicIds)
    ? params.topicIds
    : params.topicIds
      ? [params.topicIds]
      : [];
  const initialPrompt = first(params.prompt) ?? "";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <ChatApp
        initialSessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          subject_id: s.subject_id,
        }))}
        subjects={subjects}
        initialSubjectId={initialSubjectId}
        initialTopicIds={initialTopicIds}
        initialPrompt={initialPrompt}
      />
    </div>
  );
}
