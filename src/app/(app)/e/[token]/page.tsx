import {
  getEventByToken,
  getExpenses,
  getGroupsForEvent,
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
import { GroupManager } from "@/components/event/group-manager";
import { UnassignedWarnings } from "@/components/event/unassigned-warnings";
import { ErrorNote } from "@/components/ui/error-note";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Event" };

// Server actions redirect back to this page with one of these known errors.
// Anything else in the query string is attacker-supplied and must not be shown,
// so we only ever render values from these sets — everything else is ignored.
//
// Keep in sync with the redirect sites in src/lib/actions.ts and the
// ParticipantError messages thrown in src/lib/participants.ts.
const KNOWN_EVENT_ERRORS = new Set<string>([
  // ParticipantError messages (addError / claimError)
  "Account not found",
  "That account is already in this event",
  "Name is required",
  "Enter a valid email address",
  "That email is already invited to this event",
  "Participant not found",
  "That participant is already linked to an account",
  "You already participate in this event",
  // Fixed claimError strings
  "That participant cannot be claimed",
  "Only the event owner can decide claims",
]);

// deleteError carries a short code rather than a message.
const DELETE_ERROR_MESSAGES: Record<string, string> = {
  only_owner: "Only the event owner can delete this event",
};

function resolveEventError(
  addError?: string,
  claimError?: string,
  deleteError?: string,
): string | undefined {
  const message = addError ?? claimError;
  if (message && KNOWN_EVENT_ERRORS.has(message)) return message;
  if (deleteError && deleteError in DELETE_ERROR_MESSAGES) return DELETE_ERROR_MESSAGES[deleteError];
  return undefined;
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
  const [expenseRows, pendingClaims, viewerClaimedIds, eventGroups] = await Promise.all([
    getExpenses(event.id),
    isOwner ? getPendingClaims(event.id) : Promise.resolve([]),
    viewer ? claimedParticipantIdsForUser(event.id, viewer.id) : Promise.resolve(new Set<number>()),
    getGroupsForEvent(event.id),
  ]);
  const groupMembersById = new Map(eventGroups.map((g) => [g.id, g.memberIds]));
  const groupMemberLookup = (groupId: number) => groupMembersById.get(groupId) ?? [];

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

  const nets = computeNetBalances(people, ledgerExpenses, groupMemberLookup);
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
    const b = computeParticipantBreakdown(
      ledgerParticipants,
      ledgerExpenses,
      p.id,
      groupMemberLookup,
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-8 pb-20">
      <EventHeader
        token={token}
        eventName={event.name}
        viewerSignedIn={viewer != null}
        receiptCount={expenseRows.length}
        grandTotalCents={grandTotal}
      />

      {errorMessage && <ErrorNote variant="page">{errorMessage}</ErrorNote>}

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
    </main>
  );
}
