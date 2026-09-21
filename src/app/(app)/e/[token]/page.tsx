import {
  getEventByToken,
  getExpenses,
  getGroupsForEvent,
  getPaymentsForEvent,
  getPendingClaims,
  claimedParticipantIdsForUser,
} from "@/lib/queries";
import {
  computeNetBalances,
  simplifyDebts,
  computeParticipantBreakdown,
  type LedgerParticipant,
  type LedgerExpense,
  type LedgerPayment,
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
import { PaymentsPanel } from "@/components/event/payments-panel";
import { ReceiptList, type ReceiptCardData } from "@/components/event/receipt-list";
import { GroupManager } from "@/components/event/group-manager";
import { UnassignedWarnings } from "@/components/event/unassigned-warnings";
import { ViewerSummary } from "@/components/event/viewer-summary";
import { ErrorNote } from "@/components/ui/error-note";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveEventError } from "@/lib/event-errors";
import { unassignedItemWarnings } from "@/lib/warnings";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Event" };

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
    const error = resolveEventError(undefined, undefined, deleteError);
    if (error) {
      return <ErrorNote variant="page">{error}</ErrorNote>;
    }
    notFound();
  }

  const errorMessage = resolveEventError(addError, claimError, deleteError);

  const viewer = await getSessionUser();
  const isOwner = viewer != null && detail.event.ownerId === viewer.id;

  const { event, participants: people } = detail;
  const [expenseRows, pendingClaims, viewerClaimedIds, eventGroups, paymentRows] = await Promise.all([
    getExpenses(event.id),
    isOwner ? getPendingClaims(event.id) : Promise.resolve([]),
    viewer ? claimedParticipantIdsForUser(event.id, viewer.id) : Promise.resolve(new Set<number>()),
    getGroupsForEvent(event.id),
    getPaymentsForEvent(event.id),
  ]);
  const groupMembersById = new Map(eventGroups.map((g) => [g.id, g.memberIds]));
  const groupMemberLookup = (groupId: number) => groupMembersById.get(groupId) ?? [];

  const ledgerExpenses: LedgerExpense[] = expenseRows.map(({ expense, items, shares }) => ({
    id: expense.id,
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

  // PaymentRow is structurally a LedgerPayment (extra eventId is ignored).
  const ledgerPayments: LedgerPayment[] = paymentRows;
  const nets = computeNetBalances(people, ledgerExpenses, groupMemberLookup, ledgerPayments);
  const transfers = simplifyDebts(nets);
  const viewerParticipantId = viewer
    ? (people.find((p) => p.userId === viewer.id)?.id ?? null)
    : null;
  const nameOf = new Map(people.map((p) => [p.id, p.userDisplayName ?? p.name]));
  const grandTotal = expenseRows.reduce((sum, r) => sum + r.expense.totalCents, 0);
  const warnings = unassignedItemWarnings(expenseRows);

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
    const b = computeParticipantBreakdown(
      ledgerParticipants,
      ledgerExpenses,
      p.id,
      groupMemberLookup,
      ledgerPayments,
    );
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
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-8 pb-20">
      <EventHeader
        token={token}
        eventName={event.name}
        viewerSignedIn={viewer != null}
        receiptCount={expenseRows.length}
        grandTotalCents={grandTotal}
      />

      {errorMessage && <ErrorNote variant="page">{errorMessage}</ErrorNote>}

      <div className="mt-8 lg:grid lg:grid-cols-[1fr_minmax(280px,340px)] lg:gap-8">
        <div>
          <UnassignedWarnings warnings={warnings} />

          <ReceiptList token={token} receipts={receipts} nameOf={nameOf} />
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <ViewerSummary
            viewer={viewer ? { id: viewer.id } : null}
            viewerParticipantId={viewerParticipantId}
            nets={nets}
            transfers={transfers}
          />

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

          <PaymentsPanel
            token={token}
            transfers={transfers}
            history={paymentRows}
            participants={people.map((p) => ({ id: p.id, displayName: p.userDisplayName ?? p.name }))}
            nameOf={nameOf}
            viewerParticipantId={viewerParticipantId}
            claimHref={`/signin?next=${encodeURIComponent(`/e/${token}`)}`}
          />

          <section className="mt-12">
            <SectionHeading>Groups</SectionHeading>
            <p className="mt-2 mb-4 font-mono text-[11px] leading-relaxed text-stone-400">
              Reusable sets of people you can split a receipt by. Editing members re-scopes past
              receipts that use the group.
            </p>
            <GroupManager
              token={token}
              eventName={event.name}
              participants={people.map((p) => ({ id: p.id, name: p.userDisplayName ?? p.name }))}
              groups={eventGroups}
            />
          </section>

          {isOwner && (
            <section className="mt-12">
              <SectionHeading>Actions</SectionHeading>
              <div className="mt-4">
                <DeleteTabButton token={token} eventName={event.name} />
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
