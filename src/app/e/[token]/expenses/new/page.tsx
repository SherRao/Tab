import { getEventByToken } from "@/lib/queries";
import { notFound } from "next/navigation";
import ExpenseEditor from "@/components/expense-editor";
import Link from "next/link";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const detail = await getEventByToken(token);
  if (!detail) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
      <Link
        href={`/e/${token}`}
        className="text-sm text-stone-400 transition hover:text-stone-600"
      >
        ← {detail.event.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Add expense</h1>
      <div className="mt-8 pb-4">
        <ExpenseEditor token={token} participants={detail.participants} />
      </div>
    </main>
  );
}
