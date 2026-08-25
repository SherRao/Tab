import { getEventByToken } from "@/lib/queries";
import { notFound } from "next/navigation";
import NewExpenseFlow from "@/components/new-expense-flow";
import type { EditorParticipant } from "@/components/expense-editor";
import Link from "next/link";

export default async function NewExpensePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getEventByToken(token);
  if (!detail) notFound();

  const editorParticipants: EditorParticipant[] = detail.participants.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 pt-8 pb-16">
      <Link
        href={`/e/${token}`}
        className="label-mono text-stone-400 transition hover:text-foreground"
      >
        ← {detail.event.name}
      </Link>
      <h1 className="display mt-3 text-4xl sm:text-5xl">New receipt</h1>
      <div className="mt-8 pb-4">
        <NewExpenseFlow
          token={token}
          participants={editorParticipants}
          editorInitial={{
            description: "",
            payerId: undefined,
            items: [],
            tax: "",
            tip: "",
            total: "",
            splitMode: "itemized",
            evenParticipantIds: [],
            groupIds: [],
          }}
        />
      </div>
    </main>
  );
}
