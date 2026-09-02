import Link from "next/link";
import { formatCents } from "@/lib/format";
import { deleteExpenseAction } from "@/lib/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";

export interface ReceiptItemRow {
  id: number;
  name: string;
  amountCents: number;
  participantNames: string[];
}

export interface ReceiptCardData {
  expense: {
    id: number;
    description: string | null;
    payerId: number;
    taxCents: number;
    tipCents: number;
    totalCents: number;
    splitMode: string;
  };
  items: ReceiptItemRow[];
}

const MODE_LABELS: Record<string, string> = {
  itemized: "itemized",
  even: "even split",
  group: "group",
};

const TILTS = ["sm:-rotate-[0.4deg]", "", "sm:rotate-[0.4deg]"];

export function ReceiptList({
  token,
  receipts,
  nameOf,
}: {
  token: string;
  receipts: ReceiptCardData[];
  nameOf: Map<number, string>;
}) {
  return (
    <section className="mt-12">
      <SectionHeading>Receipts</SectionHeading>
      {receipts.length === 0 ? (
        <EmptyState
          message="No receipts yet."
          action={{ href: `/e/${token}/expenses/new`, label: "Add the first one →" }}
        />
      ) : (
        <ul className="mt-6 space-y-7">
          {receipts.map(({ expense, items }, idx) => (
            <li key={expense.id} className={TILTS[idx % 3]}>
              <ReceiptCard token={token} expense={expense} items={items} nameOf={nameOf} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReceiptCard({
  token,
  expense,
  items,
  nameOf,
}: {
  token: string;
  expense: ReceiptCardData["expense"];
  items: ReceiptItemRow[];
  nameOf: Map<number, string>;
}) {
  return (
    <article className="receipt-card receipt-edge receipt-lined group p-5 pb-7 transition-transform duration-200 sm:p-6 sm:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">
            {expense.description || "Untitled"}
          </h3>
          <p className="label-mono mt-1 text-stone-400">
            paid by {nameOf.get(expense.payerId)} · {MODE_LABELS[expense.splitMode]}
          </p>
        </div>
        <span className="font-mono text-xl font-bold tracking-tight tabular-nums">
          {formatCents(expense.totalCents)}
        </span>
      </div>

      {items.length > 0 && (
        <>
          <div className="rule-dashed mt-4" />
          <ul className="mt-2 space-y-1.5 font-mono text-[13px] tabular-nums">
            {items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2">
                <span className="shrink-0">
                  {item.name}
                  {item.participantNames.length > 0 && (
                    <span className="ml-2 text-[11px] text-stone-400">
                      ({item.participantNames.join(", ")})
                    </span>
                  )}
                </span>
                <span className="leader-dots" />
                <span>{formatCents(item.amountCents)}</span>
              </li>
            ))}
            {(expense.taxCents > 0 || expense.tipCents > 0) && (
              <li className="flex items-baseline gap-2 pt-0.5 text-[11px] text-stone-400">
                <span>
                  {[
                    expense.taxCents > 0 && `tax ${formatCents(expense.taxCents)}`,
                    expense.tipCents > 0 && `tip ${formatCents(expense.tipCents)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="leader-dots" />
              </li>
            )}
          </ul>
        </>
      )}

      <div className="mt-4 flex gap-1 opacity-60 transition group-hover:opacity-100">
        <Link
          href={`/e/${token}/expenses/${expense.id}/edit`}
          className="label-mono px-1 py-0.5 transition hover:text-accent-strong hover:underline"
        >
          Edit
        </Link>
        <form action={deleteExpenseAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="expenseId" value={expense.id} />
          <button
            type="submit"
            className="label-mono px-1 py-0.5 transition hover:text-red-600 hover:underline"
          >
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}
