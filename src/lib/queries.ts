import { db } from "@/db";
import {
  events,
  expenses,
  expenseShares,
  groups,
  lineItemShares,
  lineItems,
  participantClaims,
  participantGroup,
  participants,
  payments,
  users,
} from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { addParticipant, toAddParticipantInput, type CreateParticipantEntry } from "./participants";

export type ParticipantView = typeof participants.$inferSelect & {
  /** Account display name when linked; null otherwise. */
  userDisplayName: string | null;
};

export interface EventDetail {
  event: typeof events.$inferSelect;
  participants: ParticipantView[];
}

export async function getEventByToken(token: string): Promise<EventDetail | null> {
  const [event] = await db.select().from(events).where(eq(events.shareToken, token));
  if (!event) return null;
  const rows = await db
    .select({ participant: participants, userDisplayName: users.displayName })
    .from(participants)
    .leftJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.eventId, event.id))
    .orderBy(asc(participants.id));
  return {
    event,
    participants: rows.map((r) => ({ ...r.participant, userDisplayName: r.userDisplayName })),
  };
}

export interface GroupView {
  id: number;
  name: string;
  memberIds: number[];
}

/** Groups for an event, each with its current member participant ids. */
export async function getGroupsForEvent(eventId: number): Promise<GroupView[]> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.eventId, eventId))
    .orderBy(asc(groups.id));
  if (groupRows.length === 0) return [];
  const memberRows = await db
    .select()
    .from(participantGroup)
    .where(
      inArray(
        participantGroup.groupId,
        groupRows.map((g) => g.id),
      ),
    );
  return groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    memberIds: memberRows.filter((m) => m.groupId === g.id).map((m) => m.participantId),
  }));
}

/**
 * Build the live group-member lookup the ledger uses to resolve `groupId`
 * shares at compute time.
 */
export async function getGroupMemberLookup(
  eventId: number,
): Promise<(groupId: number) => number[]> {
  const groupsForEvent = await getGroupsForEvent(eventId);
  const byId = new Map(groupsForEvent.map((g) => [g.id, g.memberIds]));
  return (groupId: number) => byId.get(groupId) ?? [];
}

export interface ClaimView {
  id: number;
  participantId: number;
  requesterUserId: number;
  requesterUsername: string;
  requesterDisplayName: string;
}

export async function getPendingClaims(eventId: number): Promise<ClaimView[]> {
  return db
    .select({
      id: participantClaims.id,
      participantId: participantClaims.participantId,
      requesterUserId: participantClaims.requesterUserId,
      requesterUsername: users.username,
      requesterDisplayName: users.displayName,
    })
    .from(participantClaims)
    .innerJoin(participants, eq(participantClaims.participantId, participants.id))
    .innerJoin(users, eq(participantClaims.requesterUserId, users.id))
    .where(and(eq(participants.eventId, eventId), eq(participantClaims.status, "pending")))
    .orderBy(asc(participantClaims.id));
}

/** Participant IDs the given user already has a pending or decided claim on. */
export async function claimedParticipantIdsForUser(
  eventId: number,
  userId: number,
): Promise<Set<number>> {
  const rows = await db
    .select({ participantId: participantClaims.participantId })
    .from(participantClaims)
    .innerJoin(participants, eq(participantClaims.participantId, participants.id))
    .where(and(eq(participants.eventId, eventId), eq(participantClaims.requesterUserId, userId)));
  return new Set(rows.map((r) => r.participantId));
}

export async function getOwnedEvents(ownerId: number) {
  return db
    .select()
    .from(events)
    .where(eq(events.ownerId, ownerId))
    .orderBy(desc(events.createdAt));
}

export async function getParticipatingEvents(userId: number) {
  return db
    .select({
      id: events.id,
      name: events.name,
      shareToken: events.shareToken,
      createdAt: events.createdAt,
      ownerId: events.ownerId,
    })
    .from(participants)
    .innerJoin(events, eq(participants.eventId, events.id))
    .where(eq(participants.userId, userId))
    .orderBy(desc(events.createdAt));
}

export interface ExpenseWithItems {
  expense: typeof expenses.$inferSelect;
  items: {
    item: typeof lineItems.$inferSelect;
    participantIds: number[];
    participantQuantities: Record<number, number>;
  }[];
  shares: {
    id: number;
    expenseId: number;
    participantId: number | null;
    groupId: number | null;
    lineItemId: number | null;
    weightType: "equal" | "percent" | "amount";
    weightValue: number;
    createdAt: Date;
  }[];
}

export async function getExpenses(eventId: number): Promise<ExpenseWithItems[]> {
  const rows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.eventId, eventId))
    .orderBy(asc(expenses.id));
  if (rows.length === 0) return [];
  const itemRows = await db
    .select()
    .from(lineItems)
    .where(
      inArray(
        lineItems.expenseId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(lineItems.id));
  const itemIds = itemRows.map((i) => i.id);
  const shareRows = itemIds.length
    ? await db.select().from(lineItemShares).where(inArray(lineItemShares.lineItemId, itemIds))
    : [];

  // Fetch expense_shares for all expenses
  const expenseShareRows = await db
    .select()
    .from(expenseShares)
    .where(
      inArray(
        expenseShares.expenseId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((expense) => ({
    expense,
    items: itemRows
      .filter((i) => i.expenseId === expense.id)
      .map((item) => {
        const itemShares = shareRows.filter((s) => s.lineItemId === item.id);
        const pq: Record<number, number> = {};
        for (const s of itemShares) pq[s.participantId] = s.quantity;
        return {
          item,
          participantIds: itemShares.map((s) => s.participantId),
          participantQuantities: pq,
        };
      }),
    shares: expenseShareRows
      .filter((s) => s.expenseId === expense.id)
      .map((s) => ({
        id: s.id,
        expenseId: s.expenseId,
        participantId: s.participantId,
        groupId: s.groupId,
        lineItemId: s.lineItemId,
        weightType: s.weightType as "equal" | "percent" | "amount",
        weightValue: s.weightValue,
        createdAt: s.createdAt,
      })),
  }));
}

export type PaymentRow = typeof payments.$inferSelect;

export async function getPaymentsForEvent(eventId: number): Promise<PaymentRow[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.eventId, eventId))
    .orderBy(desc(payments.createdAt), desc(payments.id));
}

export async function createEventRecord(
  name: string,
  entries: Array<string | CreateParticipantEntry>,
  ownerId?: number | null,
) {
  const { nanoid } = await import("nanoid");
  const [event] = await db
    .insert(events)
    .values({ name, shareToken: nanoid(16), ownerId: ownerId ?? null })
    .returning();

  // Same validation as the add-person flow: required names, email format,
  // and no duplicate emails/accounts (C10).
  const created = [];
  for (const entry of entries) {
    const normalized: CreateParticipantEntry =
      typeof entry === "string" ? { mode: "guest", name: entry } : entry;
    created.push(await addParticipant(event.id, toAddParticipantInput(normalized)));
  }
  return { event, participants: created };
}
