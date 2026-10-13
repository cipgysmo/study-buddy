import { deleteQuiz, setQuizArchived } from "@/lib/quizzes";
import { deleteExercise, deleteTrueFalse, setExerciseArchived, setTrueFalseArchived } from "@/lib/practice";
import { deleteTypedExercise, setTypedExerciseArchived } from "@/lib/typed-exercises";

export const dynamic = "force-dynamic";

type BulkType = "quizzes" | "exercises" | "truefalse" | "typedexercises";
type BulkAction = "delete" | "archive" | "restore";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as { type?: BulkType; action?: BulkAction; ids?: unknown };
  const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === "string") : [];
  if (!input.type || !input.action || ids.length === 0) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  let affected = 0;
  if (input.type === "quizzes") {
    if (input.action === "delete") ids.forEach(deleteQuiz);
    if (input.action === "archive") affected = setQuizArchived(ids, true);
    if (input.action === "restore") affected = setQuizArchived(ids, false);
  } else if (input.type === "exercises") {
    if (input.action === "delete") ids.forEach(deleteExercise);
    if (input.action === "archive") affected = setExerciseArchived(ids, true);
    if (input.action === "restore") affected = setExerciseArchived(ids, false);
  } else if (input.type === "truefalse") {
    if (input.action === "delete") ids.forEach(deleteTrueFalse);
    if (input.action === "archive") affected = setTrueFalseArchived(ids, true);
    if (input.action === "restore") affected = setTrueFalseArchived(ids, false);
  } else if (input.type === "typedexercises") {
    if (input.action === "delete") ids.forEach(deleteTypedExercise);
    if (input.action === "archive") affected = setTypedExerciseArchived(ids, true);
    if (input.action === "restore") affected = setTypedExerciseArchived(ids, false);
  } else {
    return Response.json({ error: "unsupported_type" }, { status: 400 });
  }

  return Response.json({ ok: true, affected: input.action === "delete" ? ids.length : affected });
}
