import { getEventByToken, getExpenses } from "@/lib/queries";
import { toFixedMoney } from "@/lib/format";
import { notFound } from "next/navigation";
import ExpenseEditor from "@/components/expense/expense-editor";
import Link from "next/link";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const detail = await getEventByToken(token);
  if (!detail) notFound();
  const rows = await getExpenses(detail.event.id);
  const row = rows.find((r) => r.expense.id === Number(id));
  if (!row) notFound();
  const { expense, items } = row;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 pt-8 pb-16">
      <Link
        href={`/e/${token}`}
        className="label-mono text-stone-400 transition hover:text-foreground"
      >
        ← {detail.event.name}
      </Link>
      <h1 className="display mt-3 text-4xl sm:text-5xl">Edit receipt</h1>
      <div className="mt-8 pb-4">
        <ExpenseEditor
          token={token}
          participants={detail.participants}
          expenseId={expense.id}
          initial={{
            description: expense.description ?? "",
            payerId: expense.payerId,
            items: items.map((i) => ({
              name: i.item.name,
              amount: toFixedMoney(i.item.amountCents),
              participantIds: i.participantIds,
            })),
            tax: toFixedMoney(expense.taxCents),
            tip: toFixedMoney(expense.tipCents),
            total: toFixedMoney(expense.totalCents),
            splitMode: expense.splitMode,
            evenParticipantIds: [],
            groupIds: expense.groupIds ?? [],
          }}
        />
      </div>
    </main>
  );
}
