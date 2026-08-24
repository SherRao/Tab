import { db } from "@/db";
import {
  events,
  expenses,
  lineItemShares,
  lineItems,
  participants,
} from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";

export interface EventDetail {
  event: typeof events.$inferSelect;
  participants: (typeof participants.$inferSelect)[];
}

export async function getEventByToken(token: string): Promise<EventDetail | null> {
  const [event] = await db.select().from(events).where(eq(events.shareToken, token));
  if (!event) return null;
  const people = await db
    .select()
    .from(participants)
    .where(eq(participants.eventId, event.id))
    .orderBy(asc(participants.id));
  return { event, participants: people };
}

export interface ExpenseWithItems {
  expense: typeof expenses.$inferSelect;
  items: {
    item: typeof lineItems.$inferSelect;
    participantIds: number[];
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
  return rows.map((expense) => ({
    expense,
    items: itemRows
      .filter((i) => i.expenseId === expense.id)
      .map((item) => ({
        item,
        participantIds: shareRows
          .filter((s) => s.lineItemId === item.id)
          .map((s) => s.participantId),
      })),
  }));
}

export async function createEventRecord(name: string, participantNames: string[]) {
  const { nanoid } = await import("nanoid");
  const [event] = await db
    .insert(events)
    .values({ name, shareToken: nanoid(16) })
    .returning();
  await db
    .insert(participants)
    .values(participantNames.map((n) => ({ eventId: event.id, name: n })));
  return event;
}

export async function addParticipantRecord(eventId: number, name: string) {
  const [row] = await db.insert(participants).values({ eventId, name }).returning();
  return row;
}
