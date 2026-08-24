import { getEventByToken, getExpenses } from "@/lib/queries";
import { computeNetBalances, simplifyDebts } from "@/lib/ledger";
import { deleteExpenseAction, addParticipantAction } from "@/lib/actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import CopyLinkButton from "@/components/copy-link-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Event" };

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

const MODE_LABELS: Record<string, string> = {
  itemized: "itemized",
  even: "even split",
  group: "group",
};

export default async function EventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const detail = await getEventByToken(token);
  if (!detail) notFound();

  const { event, participants: people } = detail;
  const expenseRows = await getExpenses(event.id);
  const ledgerExpenses = expenseRows.map(({ expense, items }) => ({
    payerId: expense.payerId,
    taxCents: expense.taxCents,
    tipCents: expense.tipCents,
    totalCents: expense.totalCents,
    splitMode: expense.splitMode,
    evenParticipantIds: expense.evenParticipantIds ?? undefined,
    lineItems: items.map((i) => ({
      name: i.item.name,
      amountCents: i.item.amountCents,
      participantIds: i.participantIds,
    })),
  }));
  const nets = computeNetBalances(people, ledgerExpenses);
  const transfers = simplifyDebts(nets);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const unassignedWarnings = expenseRows.flatMap(({ expense, items }) =>
    items
      .filter((i) => i.participantIds.length === 0)
      .map(
        (i) =>
          `“${i.item.name}” in “${expense.description || "Untitled"}” has no assignees`,
      ),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
          <Link
            href={`/e/${token}/expenses/new`}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            + Add expense
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Share
          </span>
          <code className="min-w-0 flex-1 truncate text-sm text-stone-600">
            /e/{token}
          </code>
          <CopyLinkButton path={`/e/${token}`} />
        </div>
      </header>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold">People</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {people.map((p) => {
            const net = nets.get(p.id) ?? 0;
            return (
              <span
                key={p.id}
                className={`inline-flex items-baseline gap-2 rounded-full py-1.5 pr-3.5 pl-3.5 text-sm ring-1 ${
                  net > 0
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : net < 0
                      ? "bg-orange-50 text-orange-800 ring-orange-200"
                      : "bg-stone-100 text-stone-500 ring-stone-200"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs tabular-nums opacity-75">
                  {net > 0
                    ? `+${formatCents(net)}`
                    : net < 0
                      ? `−${formatCents(-net)}`
                      : "settled"}
                </span>
              </span>
            );
          })}
          <form action={addParticipantAction} className="flex items-center gap-1.5">
            <input type="hidden" name="token" value={token} />
            <input
              name="name"
              required
              placeholder="+ Add someone"
              size={12}
              className="rounded-full border border-dashed border-stone-300 bg-transparent px-3.5 py-1.5 text-sm placeholder:text-stone-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none"
            />
          </form>
        </div>
      </section>

      {unassignedWarnings.length > 0 && (
        <div className="mt-6 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {unassignedWarnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-semibold">Settle up</h2>
        {transfers.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-1 font-medium text-emerald-800">All settled up!</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {transfers.map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
              >
                <span className="text-sm">
                  <strong>{nameOf.get(t.fromId)}</strong>
                  <span className="mx-1.5 inline-block -translate-y-[1px] text-emerald-600">
                    ⟶
                  </span>
                  <strong>{nameOf.get(t.toId)}</strong>
                </span>
                <span className="rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-semibold tabular-nums text-white">
                  {formatCents(t.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 pb-16">
        <h2 className="font-semibold">
          Expenses{" "}
          <span className="ml-1 text-sm font-normal text-stone-400">
            {expenseRows.length > 0 && `${expenseRows.length}`}
          </span>
        </h2>
        {expenseRows.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            No expenses yet — add the first receipt!
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {expenseRows.map(({ expense, items }) => (
              <li
                key={expense.id}
                className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm transition hover:border-stone-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{expense.description || "Untitled"}</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      paid by <span className="text-stone-500">{nameOf.get(expense.payerId)}</span>{" "}
                      · {MODE_LABELS[expense.splitMode]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tabular-nums">
                      {formatCents(expense.totalCents)}
                    </span>
                    <Link
                      href={`/e/${token}/expenses/${expense.id}/edit`}
                      aria-label="Edit expense"
                      className="rounded-lg px-2 py-1 text-xs text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                    >
                      Edit
                    </Link>
                    <form action={deleteExpenseAction}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <button
                        type="submit"
                        className="rounded-lg px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                {items.length > 0 && (
                  <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-100 pt-1 text-sm">
                    {items.map(({ item, participantIds }) => (
                      <li key={item.id} className="flex justify-between gap-4 py-1.5">
                        <span className="min-w-0 truncate">
                          {item.name}
                          <span className="ml-2 text-xs text-stone-400">
                            {participantIds.map((id) => nameOf.get(id)).join(", ")}
                          </span>
                        </span>
                        <span className="tabular-nums text-stone-600">
                          {formatCents(item.amountCents)}
                        </span>
                      </li>
                    ))}
                    {(expense.taxCents > 0 || expense.tipCents > 0) && (
                      <li className="flex justify-between gap-4 py-1.5 text-xs text-stone-400">
                        <span>
                          {[
                            expense.taxCents > 0 &&
                              `tax ${formatCents(expense.taxCents)}`,
                            expense.tipCents > 0 &&
                              `tip ${formatCents(expense.tipCents)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="tabular-nums"></span>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
