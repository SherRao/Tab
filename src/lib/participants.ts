import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, participants, users } from "@/db/schema";

export type ParticipantRow = typeof participants.$inferSelect;

export type ParticipantState = "linked" | "invited" | "guest";

/** One entry of the shared "add people" payload used by create + add flows. */
export interface CreateParticipantEntry {
  mode: "account" | "guest" | "invite";
  userId?: number;
  name?: string;
  email?: string;
}

export function participantState(p: {
  userId: number | null;
  email: string | null;
  invitedAt: Date | null;
}): ParticipantState {
  if (p.userId != null) return "linked";
  if (p.email != null && p.invitedAt != null) return "invited";
  return "guest";
}

export interface AccountSuggestion {
  id: number;
  username: string;
  displayName: string;
  email: string;
}

/** Signed-in-only account search: username substring or exact email. */
export async function searchAccounts(query: string): Promise<AccountSuggestion[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .where(or(sql`${users.username} like ${"%" + q + "%"}`, eq(users.email, q)))
    .limit(8);
  return rows;
}

export type AddParticipantInput =
  | { mode: "account"; userId: number }
  | { mode: "guest"; name: string; email?: string }
  | { mode: "invite"; name: string; email: string };

export class ParticipantError extends Error {}

export async function addParticipant(
  eventId: number,
  input: AddParticipantInput,
): Promise<ParticipantRow> {
  if (input.mode === "account") {
    const [user] = await db.select().from(users).where(eq(users.id, input.userId));
    if (!user) throw new ParticipantError("Account not found");
    const existing = await findLinkedParticipant(eventId, user.id);
    if (existing) throw new ParticipantError("That account is already in this event");
    const [row] = await db
      .insert(participants)
      .values({ eventId, name: user.displayName, userId: user.id })
      .returning();
    return row;
  }

  const name = input.name.trim();
  if (!name) throw new ParticipantError("Name is required");

  if (input.mode === "guest") {
    const email = input.email?.trim().toLowerCase() || undefined;
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ParticipantError("Enter a valid email address");
      }
      await assertEmailFreeInEvent(eventId, email);
    }
    const [row] = await db
      .insert(participants)
      .values({ eventId, name, email: email ?? null })
      .returning();
    return row;
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ParticipantError("Enter a valid email address");
  }
  await assertEmailFreeInEvent(eventId, email);
  const [row] = await db
    .insert(participants)
    .values({ eventId, name, email, invitedAt: new Date() })
    .returning();
  return row;
}

export async function findLinkedParticipant(eventId: number, userId: number) {
  const [row] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.userId, userId)));
  return row ?? null;
}

async function assertEmailFreeInEvent(eventId: number, email: string) {
  const [dupe] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.email, email)));
  if (dupe) throw new ParticipantError("That email is already invited to this event");
}

/**
 * Link an account to a participant ("merge"/claim primitive).
 * Idempotent for the same pairing; enforces one-account-per-event.
 */
export async function linkAccountToParticipant(
  participantId: number,
  userId: number,
): Promise<void> {
  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  if (!participant) throw new ParticipantError("Participant not found");
  if (participant.userId === userId) return;

  if (participant.userId != null) {
    throw new ParticipantError("That participant is already linked to an account");
  }
  const existing = await findLinkedParticipant(participant.eventId, userId);
  if (existing) throw new ParticipantError("You already participate in this event");

  await db
    .update(participants)
    .set({ userId, email: null, invitedAt: null })
    .where(eq(participants.id, participantId));
}

export async function getEventOwnerId(eventId: number): Promise<number | null> {
  const [event] = await db
    .select({ ownerId: events.ownerId })
    .from(events)
    .where(eq(events.id, eventId));
  return event?.ownerId ?? null;
}

/** Accounts already backing a participant of this event — powers "already added". */
export async function linkedUserIdsForEvent(eventId: number): Promise<Set<number>> {
  const rows = await db
    .select({ userId: participants.userId })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), ne(participants.userId, sql`null`)));
  return new Set(rows.map((r) => r.userId).filter((id): id is number => id != null));
}
