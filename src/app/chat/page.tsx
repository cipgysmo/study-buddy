import { getTranslations } from "next-intl/server";
import { listSessions } from "@/lib/chat";
import { listSubjects } from "@/lib/subjects";
import { ChatApp } from "@/components/chat/chat-app";

export default async function ChatPage() {
  const t = await getTranslations("Chat");
  const sessions = listSessions();
  const subjects = listSubjects().map((s) => ({ id: s.id, name: s.name }));

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
      />
    </div>
  );
}
