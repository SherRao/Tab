import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, participants, users } from "@/db/schema";
import { EVENT_ERRORS } from "./event-errors";

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
}

/**
 * Signed-in-only account search: username substring or exact email. Email is
 * matched but never returned — the add-person UI only needs id/username/
 * displayName, and returning addresses would let any signed-in user enumerate
 * every registered email.
 */
export async function searchAccounts(query: string): Promise<AccountSuggestion[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
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

/** Narrow a loose add-people entry to the strict input `addParticipant` validates. */
export function toAddParticipantInput(entry: CreateParticipantEntry): AddParticipantInput {
  if (entry.mode === "account") return { mode: "account", userId: Number(entry.userId) };
  if (entry.mode === "invite") {
    return { mode: "invite", name: String(entry.name ?? ""), email: String(entry.email ?? "") };
  }
  return {
    mode: "guest",
    name: String(entry.name ?? ""),
    email: entry.email ? String(entry.email) : undefined,
  };
}

export class ParticipantError extends Error {}

export async function addParticipant(
  eventId: number,
  input: AddParticipantInput,
): Promise<ParticipantRow> {
  if (input.mode === "account") {
    const [user] = await db.select().from(users).where(eq(users.id, input.userId));
    if (!user) throw new ParticipantError(EVENT_ERRORS.accountNotFound);
    const existing = await findLinkedParticipant(eventId, user.id);
    if (existing) throw new ParticipantError(EVENT_ERRORS.accountAlreadyInEvent);
    const [row] = await db
      .insert(participants)
      .values({ eventId, name: user.displayName, userId: user.id })
      .returning();
    return row;
  }

  const name = input.name.trim();
  if (!name) throw new ParticipantError(EVENT_ERRORS.nameRequired);

  if (input.mode === "guest") {
    const email = input.email?.trim().toLowerCase() || undefined;
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ParticipantError(EVENT_ERRORS.invalidEmail);
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
    throw new ParticipantError(EVENT_ERRORS.invalidEmail);
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
  if (dupe) throw new ParticipantError(EVENT_ERRORS.emailAlreadyInvited);
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
  if (!participant) throw new ParticipantError(EVENT_ERRORS.participantNotFound);
  if (participant.userId === userId) return;

  if (participant.userId != null) {
    throw new ParticipantError(EVENT_ERRORS.alreadyLinked);
  }
  const existing = await findLinkedParticipant(participant.eventId, userId);
  if (existing) throw new ParticipantError(EVENT_ERRORS.alreadyParticipate);

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
