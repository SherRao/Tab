import {
  getEventByToken,
  getExpenses,
  getPendingClaims,
  claimedParticipantIdsForUser,
} from "@/lib/queries";
import {
  computeNetBalances,
  simplifyDebts,
  computeParticipantBreakdown,
  type LedgerParticipant,
  type LedgerExpense,
} from "@/lib/ledger";
import { addParticipantAction } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { EventHeader } from "@/components/event/event-header";
import DeleteTabButton from "@/components/event/delete-tab-button";
import {
  BalanceList,
  type BalancePerson,
  type PendingClaimRow,
} from "@/components/event/balance-list";
import type { ParticipantBreakdownView } from "@/components/event/balance-breakdown";
import { ClaimRequests } from "@/components/event/claim-requests";
import { SettleUpList } from "@/components/event/settle-up-list";
import { ReceiptList, type ReceiptCardData } from "@/components/event/receipt-list";
import { UnassignedWarnings } from "@/components/event/unassigned-warnings";
import { ErrorNote } from "@/components/ui/error-note";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Event" };

function getErrorMessage(
  error?: string | undefined,
): string | undefined {
  if (!error) return undefined;
  if (error.includes("only_owner")) return "Only the event owner can view this page";
  if (error.includes("delete")) return "This event has been deleted";
  return error;
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ addError?: string; claimError?: string; deleteError?: string }>;
}) {
  const [{ token }, { addError, claimError, deleteError }] = await Promise.all([params, searchParams]);
  const detail = await getEventByToken(token);
  if (!detail) {
    const error = getErrorMessage(deleteError);
    if (error) {
      return <ErrorNote variant="page">{error}</ErrorNote>;
    }
    notFound();
  }

  const viewer = await getSessionUser();
  const isOwner = viewer != null && detail.event.ownerId === viewer.id;

  const { event, participants: people } = detail;
  const [expenseRows, pendingClaims, viewerClaimedIds] = await Promise.all([
    getExpenses(event.id),
    isOwner ? getPendingClaims(event.id) : Promise.resolve([]),
    viewer ? claimedParticipantIdsForUser(event.id, viewer.id) : Promise.resolve(new Set<number>()),
  ]);

  const ledgerExpenses: LedgerExpense[] = expenseRows.map(({ expense, items, shares }) => ({
    payerId: expense.payerId,
    description: expense.description ?? undefined,
    taxCents: expense.taxCents,
    tipCents: expense.tipCents,
    totalCents: expense.totalCents,
    splitMode: expense.splitMode as "itemized" | "even",
    lineItems: items.map((i) => ({
      id: i.item.id,
      name: i.item.name,
      amountCents: i.item.amountCents,
      participantIds: i.participantIds,
    })),
    shares: shares.map((s) => ({
      participantId: s.participantId != null ? s.participantId : undefined,
      groupId: s.groupId != null ? s.groupId : undefined,
      lineItemId: s.lineItemId != null ? s.lineItemId : undefined,
      weightType: s.weightType,
      weightValue: s.weightValue,
    })),
  }));

  const nets = computeNetBalances(people, ledgerExpenses);
  const transfers = simplifyDebts(nets);
  const nameOf = new Map(people.map((p) => [p.id, p.userDisplayName ?? p.name]));
  const grandTotal = expenseRows.reduce((sum, r) => sum + r.expense.totalCents, 0);
  const warnings = expenseRows.flatMap(({ expense, items }) =>
    items
      .filter((i) => i.participantIds.length === 0)
      .map((i) => `"${i.item.name}" in "${expense.description || "Untitled"}" has no assignees`),
  );

  const balancePeople: BalancePerson[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.userDisplayName ?? p.name,
    userId: p.userId,
    email: p.email,
    invitedAt: p.invitedAt,
  }));

  const claimRows: PendingClaimRow[] = pendingClaims.map((c) => ({
    id: c.id,
    participantId: c.participantId,
    requesterUsername: c.requesterUsername,
    requesterDisplayName: c.requesterDisplayName,
  }));
  const guestNameOf = (participantId: number) =>
    people.find((p) => p.id === participantId)?.name ?? "?";

  const receipts: ReceiptCardData[] = expenseRows.map(({ expense, items, shares }) => ({
    expense: {
      id: expense.id,
      description: expense.description,
      payerId: expense.payerId,
      taxCents: expense.taxCents,
      tipCents: expense.tipCents,
      totalCents: expense.totalCents,
      splitMode: expense.splitMode,
    },
    items: items.map(({ item, participantIds }) => ({
      id: item.id,
      name: item.name,
      amountCents: item.amountCents,
      participantNames: participantIds.map((id) => nameOf.get(id) ?? "?"),
    })),
    shares: shares.map((s) => ({
      participantId: s.participantId != null ? s.participantId : undefined,
      groupId: s.groupId != null ? s.groupId : undefined,
      lineItemId: s.lineItemId != null ? s.lineItemId : undefined,
      weightType: s.weightType,
      weightValue: s.weightValue,
    })),
  }));

  const ledgerParticipants: LedgerParticipant[] = people.map((p) => ({
    id: p.id,
    name: p.userDisplayName ?? p.name,
  }));

  const breakdowns = new Map<number, ParticipantBreakdownView>();
  for (const p of people) {
    const b = computeParticipantBreakdown(ledgerParticipants, ledgerExpenses, p.id);
    breakdowns.set(p.id, {
      items: b.items.map((i) => ({ ...i })),
      taxShareCents: b.taxShareCents,
      tipShareCents: b.tipShareCents,
      otherExtrasShareCents: b.otherExtrasShareCents,
      totalConsumedCents: b.totalConsumedCents,
      totalPaidCents: b.totalPaidCents,
      netCents: b.netCents,
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-8 pb-20">
      <EventHeader
        token={token}
        eventName={event.name}
        viewerSignedIn={viewer != null}
        receiptCount={expenseRows.length}
        grandTotalCents={grandTotal}
      />

      {(addError || claimError || deleteError) && (
        <ErrorNote variant="page">{addError ?? claimError ?? deleteError}</ErrorNote>
      )}

      <BalanceList
        token={token}
        people={balancePeople}
        nets={nets}
        pendingClaims={claimRows}
        viewerClaimedIds={viewerClaimedIds}
        viewer={viewer ? { id: viewer.id, displayName: viewer.displayName } : null}
        addAction={addParticipantAction}
        breakdowns={breakdowns}
      />

      <ClaimRequests token={token} claims={claimRows} guestNameOf={guestNameOf} />

      <UnassignedWarnings warnings={warnings} />

      <SettleUpList transfers={transfers} nameOf={nameOf} />

      <ReceiptList token={token} receipts={receipts} nameOf={nameOf} />

      {isOwner && (
        <section className="mt-12">
          <SectionHeading>Actions</SectionHeading>
          <div className="mt-4">
            <DeleteTabButton token={token} eventName={event.name} />
          </div>
        </section>
      )}
    </main>
  );
}
