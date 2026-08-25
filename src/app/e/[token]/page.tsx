import {
  getEventByToken,
  getExpenses,
  getPendingClaims,
  hasClaimedParticipant,
} from "@/lib/queries";
import { computeNetBalances, simplifyDebts } from "@/lib/ledger";
import {
  deleteExpenseAction,
  addParticipantAction,
  requestClaimAction,
  decideClaimAction,
} from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { participantState } from "@/lib/participants";
import { notFound } from "next/navigation";
import Link from "next/link";
import CopyLinkButton from "@/components/copy-link-button";
import { AddSomeoneControl } from "@/components/add-people";
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

const STATE_BADGES = {
  linked: null,
  invited: "invited",
  guest: "no account",
} as const;

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ addError?: string; claimError?: string }>;
}) {
  const [{ token }, { addError, claimError }] = await Promise.all([params, searchParams]);
  const detail = await getEventByToken(token);
  if (!detail) notFound();

  const viewer = await getSessionUser();
  const isOwner = viewer != null && detail.event.ownerId === viewer.id;

  const { event, participants: people } = detail;
  const [expenseRows, pendingClaims, viewerHasClaimed] = await Promise.all([
    getExpenses(event.id),
    isOwner ? getPendingClaims(event.id) : Promise.resolve([]),
    viewer ? hasClaimedParticipant(event.id, viewer.id) : Promise.resolve(false),
  ]);
  const pendingByParticipant = new Map(pendingClaims.map((c) => [c.participantId, c]));

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
  const nameOf = new Map(
    people.map((p) => [p.id, p.userDisplayName ?? p.name]),
  );
  const grandTotal = expenseRows.reduce((sum, r) => sum + r.expense.totalCents, 0);
  const unassignedWarnings = expenseRows.flatMap(({ expense, items }) =>
    items
      .filter((i) => i.participantIds.length === 0)
      .map(
        (i) =>
          `“${i.item.name}” in “${expense.description || "Untitled"}” has no assignees`,
      ),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-8 pb-20">
      {/* header */}
      <header>
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href="/"
            className="label-mono text-stone-400 transition hover:text-foreground"
          >
            ← new tab
          </Link>
          <Link
            href={`/e/${token}/expenses/new`}
            className="btn-ink px-4 py-2.5"
          >
            + Add expense
          </Link>
        </div>
        <h1 className="display mt-4 text-5xl sm:text-6xl">{event.name}</h1>

        {/* share strip */}
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-dashed border-foreground/25 py-2.5">
          <span className="label-mono text-stone-400">Share</span>
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-stone-600">
            /e/{token}
          </code>
          <CopyLinkButton path={`/e/${token}`} />
        </div>

        {!viewer && (
          <p className="paper-card mt-4 flex flex-wrap items-center justify-between gap-2 p-3 font-mono text-xs text-stone-500">
            <span>You&apos;re viewing read-only.</span>
            <Link
              href={`/signin?next=${encodeURIComponent(`/e/${token}`)}`}
              className="label-mono text-accent-strong hover:underline"
            >
              Sign in to edit →
            </Link>
          </p>
        )}

        {expenseRows.length > 0 && (
          <div className="mt-4 flex items-baseline justify-between font-mono text-sm tabular-nums">
            <span className="label-mono text-stone-400">
              {expenseRows.length} receipt{expenseRows.length > 1 ? "s" : ""} on file
            </span>
            <span className="font-semibold">{formatCents(grandTotal)}</span>
          </div>
        )}
      </header>

      {(addError || claimError) && (
        <div className="mt-6 border-l-4 border-l-red-400 bg-red-50 px-4 py-2 font-mono text-xs text-red-700">
          ! {addError ?? claimError}
        </div>
      )}

      {/* balances */}
      <section className="mt-12">
        <h2 className="label-mono border-b border-foreground/15 pb-2 text-stone-400">
          Balances
        </h2>
        <ul className="divide-y divide-dashed divide-foreground/10">
          {people.map((p) => {
            const net = nets.get(p.id) ?? 0;
            const state = participantState({
              userId: p.userId,
              email: p.email,
              invitedAt: p.invitedAt,
            });
            const badge = STATE_BADGES[state];
            return (
              <li key={p.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        net > 0
                          ? "bg-accent"
                          : net < 0
                            ? "bg-orange-500"
                            : "bg-stone-300"
                      }`}
                    />
                    <span className="truncate font-medium">{nameOf.get(p.id)}</span>
                    {badge && (
                      <span className="label-mono shrink-0 border border-dashed border-stone-300 px-1.5 py-0.5 text-[10px] text-stone-400">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      net > 0
                        ? "text-accent-strong"
                        : net < 0
                          ? "text-orange-600"
                          : "text-stone-400"
                    }`}
                  >
                    {net > 0
                      ? `gets back ${formatCents(net)}`
                      : net < 0
                        ? `owes ${formatCents(-net)}`
                        : "settled"}
                  </span>
                </div>
                {state === "guest" && viewer && viewer.id !== p.userId && (
                  <div className="mt-1 pl-[18px]">
                    {pendingByParticipant.has(p.id) ? (
                      <span className="label-mono text-[11px] text-stone-400">
                        claim requested — waiting on{" "}
                        {pendingByParticipant.get(p.id)?.requesterDisplayName ===
                        viewer.displayName
                          ? "the owner"
                          : "owner approval"}
                      </span>
                    ) : viewerHasClaimed ? (
                      <span className="label-mono text-[11px] text-stone-300">
                        you already have a claim here
                      </span>
                    ) : (
                      <form action={requestClaimAction}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="participantId" value={p.id} />
                        <button
                          type="submit"
                          className="label-mono text-[11px] text-stone-400 transition hover:text-accent-strong hover:underline"
                        >
                          “{nameOf.get(p.id)}” is me — request to claim
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {viewer ? (
          <AddSomeoneControl
            token={token}
            addedUserIds={people.map((p) => p.userId).filter((id): id is number => id != null)}
            addAction={addParticipantAction}
          />
        ) : (
          <p className="label-mono mt-3 text-stone-300">sign in to add people</p>
        )}
      </section>

      {/* owner: pending claims */}
      {isOwner && pendingClaims.length > 0 && (
        <section className="mt-8">
          <h2 className="label-mono border-b border-foreground/15 pb-2 text-stone-400">
            Claim requests
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingClaims.map((claim) => {
              const guestName =
                people.find((p) => p.id === claim.participantId)?.name ?? "?";
              return (
                <li
                  key={claim.id}
                  className="paper-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                >
                  <span className="text-sm">
                    <strong>@{claim.requesterUsername}</strong>
                    <span className="text-stone-500"> says they&apos;re </span>
                    <strong>{guestName}</strong>
                  </span>
                  <span className="flex gap-2">
                    <form action={decideClaimAction}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="claimId" value={claim.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button type="submit" className="btn-ink px-3 py-1.5 text-xs">
                        Approve
                      </button>
                    </form>
                    <form action={decideClaimAction}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="claimId" value={claim.id} />
                      <input type="hidden" name="decision" value="deny" />
                      <button
                        type="submit"
                        className="btn-ghost px-3 py-1.5 text-xs hover:text-red-600"
                      >
                        Deny
                      </button>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unassignedWarnings.length > 0 && (
        <div className="paper-card mt-8 space-y-1 border-l-4 border-l-amber-400 p-4 font-mono text-xs leading-relaxed text-amber-800">
          {unassignedWarnings.map((w) => (
            <p key={w}>! {w}</p>
          ))}
        </div>
      )}

      {/* settle up */}
      <section className="mt-12">
        <h2 className="label-mono border-b border-foreground/15 pb-2 text-stone-400">
          Settle up
        </h2>
        {transfers.length === 0 ? (
          <div className="receipt-card receipt-lined mt-4 p-8 pb-9 text-center">
            <span className="stamp">all settled ✓</span>
            <p className="mt-3 font-mono text-xs text-stone-400">
              nothing to transfer right now
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {transfers.map((t, i) => (
              <li
                key={i}
                className="paper-card flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm">
                  <strong>{nameOf.get(t.fromId)}</strong>
                  <span className="mx-2 inline-block -translate-y-[1px] font-mono text-accent">
                    ⟶
                  </span>
                  <strong>{nameOf.get(t.toId)}</strong>
                </span>
                <span className="border border-accent-strong/60 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-accent-strong">
                  {formatCents(t.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* receipts */}
      <section className="mt-12">
        <h2 className="label-mono border-b border-foreground/15 pb-2 text-stone-400">
          Receipts
        </h2>
        {expenseRows.length === 0 ? (
          <div className="mt-4 border border-dashed border-foreground/25 p-10 text-center">
            <p className="font-medium text-stone-500">No receipts yet.</p>
            <Link
              href={`/e/${token}/expenses/new`}
              className="label-mono mt-2 inline-block text-accent-strong hover:underline"
            >
              Add the first one →
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-7">
            {expenseRows.map(({ expense, items }, idx) => {
              const tilt =
                ["sm:-rotate-[0.4deg]", "", "sm:rotate-[0.4deg]"][idx % 3];
              return (
                <li key={expense.id} className={`${tilt}`}>
                  <article className="receipt-card receipt-edge receipt-lined group p-5 pb-7 transition-transform duration-200 sm:p-6 sm:pb-8">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight">
                          {expense.description || "Untitled"}
                        </h3>
                        <p className="label-mono mt-1 text-stone-400">
                          paid by {nameOf.get(expense.payerId)} ·{" "}
                          {MODE_LABELS[expense.splitMode]}
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
                          {items.map(({ item, participantIds }) => (
                            <li key={item.id} className="flex items-baseline gap-2">
                              <span className="shrink-0">
                                {item.name}
                                {participantIds.length > 0 && (
                                  <span className="ml-2 text-[11px] text-stone-400">
                                    ({participantIds.map((id) => nameOf.get(id)).join(", ")})
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
                                  expense.taxCents > 0 &&
                                    `tax ${formatCents(expense.taxCents)}`,
                                  expense.tipCents > 0 &&
                                    `tip ${formatCents(expense.tipCents)}`,
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
