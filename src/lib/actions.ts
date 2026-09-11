"use server";

import { db } from "@/db";
import {
  expenses,
  expenseShares,
  groups,
  lineItemShares,
  lineItems,
  participantClaims,
  participantGroup,
  participants,
  SPLIT_MODES,
  type SplitMode,
  events,
} from "@/db/schema";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { createEventRecord, getEventByToken } from "./queries";
import { requireSession, getSessionUser, appBaseUrl, createLoginToken } from "./auth";
import { sendEmail } from "./email";
import {
  addParticipant as addParticipantRow,
  findLinkedParticipant,
  getEventOwnerId,
  linkAccountToParticipant,
  ParticipantError,
  type AddParticipantInput,
  type CreateParticipantEntry,
} from "./participants";

export async function createEventAction(formData: FormData) {
  const user = await requireSession("/");
  const name = String(formData.get("name") ?? "").trim();
  const rawJson = String(formData.get("participantsJson") ?? "");
  const rawLegacy = String(formData.get("participants") ?? "");

  let entries: CreateParticipantEntry[] = [];
  if (rawJson) {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) throw new Error("bad payload");
      entries = parsed.filter(
        (e): e is CreateParticipantEntry =>
          typeof e === "object" &&
          e !== null &&
          "mode" in e &&
          ["account", "guest", "invite"].includes(String((e as CreateParticipantEntry).mode)),
      );
    } catch {
      redirect("/create?error=1");
    }
  } else {
    entries = rawLegacy
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ mode: "guest" as const, name: n }));
  }

  if (!name || entries.length < 1) {
    redirect("/create?error=1");
  }

  const { event, participants: created } = await createEventRecord(name, entries, user.id);

  try {
    await addParticipantRow(event.id, { mode: "account", userId: user.id });
} catch {
    await addParticipantRow(event.id, { mode: "guest", name: user.displayName ?? user.username ?? "You" });
  }

  // Send invitation emails for any invited participants created up front.
  for (const person of created) {
    if (person.email == null || person.invitedAt == null) continue;
    try {
      const token = await createLoginToken(person.email, person.id);
      await sendEmail({
        to: person.email,
        subject: `You're on "${event.name}" — join your tab`,
        text: invitationEmailBody(event.name, token, `/e/${event.shareToken}`),
      });
    } catch (err) {
      console.error("invite email failed", err);
    }
  }

  revalidatePath("/");
  revalidatePath("/tabs");
  redirect(`/e/${event.shareToken}`);
}

function invitationEmailBody(eventName: string, token: string, eventPath: string): string {
  return [
    `You've been added to "${eventName}" on Tab.`,
    "",
    "Open this link to join (it signs you in or creates your account):",
    `${appBaseUrl()}/auth/verify?token=${token}&next=${encodeURIComponent(eventPath)}`,
    "",
    "The link expires in 15 minutes — you can always reach the tab at:",
    appBaseUrl() + eventPath,
  ].join("\n");
}

export async function addParticipantAction(formData: FormData) {
  await requireSession();
  const token = String(formData.get("token") ?? "");
  const detail = await getEventByToken(token);
  if (!detail) redirect("/");

  let parsed: CreateParticipantEntry;
  try {
    parsed = JSON.parse(String(formData.get("entry") ?? "{}"));
  } catch {
    return;
  }

  try {
    const input: AddParticipantInput =
      parsed.mode === "account"
        ? { mode: "account", userId: Number(parsed.userId) }
        : parsed.mode === "invite"
          ? { mode: "invite", name: String(parsed.name ?? ""), email: String(parsed.email ?? "") }
          : { mode: "guest", name: String(parsed.name ?? ""), email: parsed.email ? String(parsed.email) : undefined };
    if (input.mode === "account" && !Number.isInteger(input.userId)) return;

    const row = await addParticipantRow(detail.event.id, input);
    if (row.email != null && row.invitedAt != null) {
      const inviteToken = await createLoginToken(row.email, row.id);
      await sendEmail({
        to: row.email,
        subject: `You're on "${detail.event.name}" — join your tab`,
        text: invitationEmailBody(detail.event.name, inviteToken, `/e/${token}`),
      });
    }
  } catch (e) {
    if (!(e instanceof ParticipantError)) throw e;
    redirect(`/e/${token}?addError=${encodeURIComponent(e.message)}`);
  }
  revalidatePath(`/e/${token}`);
}

export interface ExpensePayload {
  payerId: number;
  description: string;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  splitMode: SplitMode;
  items: { name: string; amountCents: number; participantIds: number[]; quantity?: number; participantQuantities?: Record<number, number> }[];
  shares: {
    participantId?: number;
    groupId?: number;
    /** Index into `items`, for weights scoped to a single line item. */
    itemIndex?: number;
    lineItemId?: number | null;
    weightType: "equal" | "percent" | "amount";
    weightValue: number;
  }[];
}

/**
 * Insert `expense_shares`, resolving item-scoped weights to the line item ids
 * created for this save. `itemIndex` indexes `payload.items`.
 */
async function insertExpenseShares(
  expenseId: number,
  shares: ExpensePayload["shares"],
  lineItemIds: number[],
) {
  if (shares.length === 0) return;
  await db.insert(expenseShares).values(
    shares.map((s) => ({
      expenseId,
      participantId: s.participantId ?? null,
      groupId: s.groupId ?? null,
      lineItemId: s.itemIndex != null ? (lineItemIds[s.itemIndex] ?? null) : (s.lineItemId ?? null),
      weightType: s.weightType,
      weightValue: s.weightValue,
    })),
  );
}

export async function saveExpenseAction(token: string, payload: ExpensePayload) {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) throw new Error("Event not found");
  if (!SPLIT_MODES.includes(payload.splitMode)) throw new Error("Invalid split mode");
  const validIds = new Set(detail.participants.map((p) => p.id));
  if (!validIds.has(payload.payerId)) throw new Error("Payer is not a participant of this event");

  // Validate shares
  if (payload.shares.length > 0) {
    const totalLevelShares = payload.shares.filter(
      (s) => s.lineItemId == null && s.itemIndex == null,
    );
    const percentShares = totalLevelShares.filter((s) => s.weightType === "percent");
    if (percentShares.length > 0) {
      const sum = percentShares.reduce((a, s) => a + s.weightValue, 0);
      if (sum !== 10000) throw new Error("Percent shares must sum to 100%");
    }
    const amountShares = totalLevelShares.filter((s) => s.weightType === "amount");
    if (amountShares.length > 0) {
      const sum = amountShares.reduce((a, s) => a + s.weightValue, 0);
      if (sum !== payload.totalCents) throw new Error("Amount shares must sum to total");
    }
  }

  const [expense] = await db
    .insert(expenses)
    .values({
      eventId: detail.event.id,
      payerId: payload.payerId,
      description: payload.description,
      taxCents: payload.taxCents,
      tipCents: payload.tipCents,
      totalCents: payload.totalCents,
      splitMode: payload.splitMode,
    })
    .returning();

  // Line items first: shares scoped to an item need the item's real id.
  const lineItemIds: number[] = [];
  for (const item of payload.items) {
    const [row] = await db
      .insert(lineItems)
      .values({
        expenseId: expense.id,
        name: item.name,
        amountCents: item.amountCents,
      })
      .returning();
    lineItemIds.push(row.id);
    const shares = [...new Set(item.participantIds)].filter((id) => validIds.has(id));
    if (shares.length) {
      await db
        .insert(lineItemShares)
        .values(shares.map((participantId) => ({ lineItemId: row.id, participantId })));
    }
  }

  await insertExpenseShares(expense.id, payload.shares, lineItemIds);

  revalidatePath(`/e/${token}`);
}

export async function updateExpenseAction(
  token: string,
  expenseId: number,
  payload: ExpensePayload,
) {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) throw new Error("Event not found");
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.eventId, detail.event.id)));
  if (!existing) throw new Error("Expense not found");
  const validIds = new Set(detail.participants.map((p) => p.id));
  if (!validIds.has(payload.payerId)) throw new Error("Payer is not a participant of this event");

  // Validate shares
  if (payload.shares.length > 0) {
    const totalLevelShares = payload.shares.filter(
      (s) => s.lineItemId == null && s.itemIndex == null,
    );
    const percentShares = totalLevelShares.filter((s) => s.weightType === "percent");
    if (percentShares.length > 0) {
      const sum = percentShares.reduce((a, s) => a + s.weightValue, 0);
      if (sum !== 10000) throw new Error("Percent shares must sum to 100%");
    }
    const amountShares = totalLevelShares.filter((s) => s.weightType === "amount");
    if (amountShares.length > 0) {
      const sum = amountShares.reduce((a, s) => a + s.weightValue, 0);
      if (sum !== payload.totalCents) throw new Error("Amount shares must sum to total");
    }
  }

  await db
    .update(expenses)
    .set({
      payerId: payload.payerId,
      description: payload.description,
      taxCents: payload.taxCents,
      tipCents: payload.tipCents,
      totalCents: payload.totalCents,
      splitMode: payload.splitMode,
    })
    .where(eq(expenses.id, expenseId));

  await db.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));

  // Replace line items before re-inserting shares, so item-scoped shares can
  // point at the new line item ids.
  const oldItems = await db
    .select({ id: lineItems.id })
    .from(lineItems)
    .where(eq(lineItems.expenseId, expenseId));
  if (oldItems.length) {
    await db.delete(lineItemShares).where(
      inArray(
        lineItemShares.lineItemId,
        oldItems.map((i) => i.id),
      ),
    );
    await db.delete(lineItems).where(eq(lineItems.expenseId, expenseId));
  }

  const lineItemIds: number[] = [];
  for (const item of payload.items) {
    const [row] = await db
      .insert(lineItems)
      .values({ expenseId, name: item.name, amountCents: item.amountCents })
      .returning();
    lineItemIds.push(row.id);
    const shares = [...new Set(item.participantIds)].filter((id) => validIds.has(id));
    if (shares.length) {
      await db
        .insert(lineItemShares)
        .values(shares.map((participantId) => ({ lineItemId: row.id, participantId })));
    }
  }

  await insertExpenseShares(expenseId, payload.shares, lineItemIds);

  revalidatePath(`/e/${token}`);
}

export async function deleteExpenseAction(formData: FormData) {
  await requireSession();
  const token = String(formData.get("token") ?? "");
  const expenseId = Number(formData.get("expenseId"));
  const detail = await getEventByToken(token);
  if (detail && Number.isFinite(expenseId)) {
    await db
      .delete(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.eventId, detail.event.id)));
    revalidatePath(`/e/${token}`);
  }
}

export async function deleteEventAction(token: string) {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) redirect("/");

  const viewer = await getSessionUser();
  if (viewer == null || detail.event.ownerId !== viewer.id) {
    redirect(`/e/${token}?deleteError=only_owner`);
  }

  // expenses.payerId is ON DELETE RESTRICT (src/db/schema.ts), so dependents
  // must be removed before the event cascade reaches participants.
  await db.delete(expenses).where(eq(expenses.eventId, detail.event.id));
  await db.delete(participants).where(eq(participants.eventId, detail.event.id));
  await db.delete(events).where(eq(events.id, detail.event.id));
  revalidatePath("/");
  revalidatePath("/tabs");
  redirect("/tabs");
}

/** A signed-in user asks to claim a bare-name guest as themselves. */
export async function requestClaimAction(formData: FormData) {
  const user = await requireSession();
  const token = String(formData.get("token") ?? "");
  const participantId = Number(formData.get("participantId"));
  const detail = await getEventByToken(token);
  if (!detail || !Number.isFinite(participantId)) redirect("/");

  const participant = detail.participants.find((p) => p.id === participantId);
  if (!participant || participant.userId != null) {
    redirect(`/e/${token}?claimError=${encodeURIComponent("That participant cannot be claimed")}`);
  }
  if (await findLinkedParticipant(detail.event.id, user.id)) {
    redirect(
      `/e/${token}?claimError=${encodeURIComponent("You already participate in this event")}`,
    );
  }

  try {
    await db.insert(participantClaims).values({
      participantId,
      requesterUserId: user.id,
    });
  } catch {
    // Unique pending claim per (participant, requester): already requested.
  }
  revalidatePath(`/e/${token}`);
}

/** Owner approves a pending claim, linking the requester's account. */
export async function decideClaimAction(formData: FormData) {
  const user = await requireSession();
  const token = String(formData.get("token") ?? "");
  const claimId = Number(formData.get("claimId"));
  const decision = String(formData.get("decision") ?? "");
  const detail = await getEventByToken(token);
  if (!detail || !Number.isFinite(claimId)) redirect("/");

  const ownerId = await getEventOwnerId(detail.event.id);
  if (ownerId !== user.id) {
    redirect(
      `/e/${token}?claimError=${encodeURIComponent("Only the event owner can decide claims")}`,
    );
  }

  const [claim] = await db
    .select({ id: participantClaims.id, participantId: participantClaims.participantId, requesterUserId: participantClaims.requesterUserId })
    .from(participantClaims)
    .innerJoin(participants, eq(participantClaims.participantId, participants.id))
    .where(and(
      eq(participantClaims.id, claimId),
      eq(participantClaims.status, "pending"),
      eq(participants.eventId, detail.event.id),
    ));
  if (!claim) redirect(`/e/${token}`);

  if (decision === "approve") {
    try {
      await linkAccountToParticipant(claim.participantId, claim.requesterUserId);
      await db
        .update(participantClaims)
        .set({ status: "approved", decidedAt: new Date() })
        .where(eq(participantClaims.id, claimId));
    } catch (e) {
      if (!(e instanceof ParticipantError)) throw e;
      redirect(`/e/${token}?claimError=${encodeURIComponent(e.message)}`);
    }
  } else if (decision === "deny") {
    await db
      .update(participantClaims)
      .set({ status: "denied", decidedAt: new Date() })
      .where(eq(participantClaims.id, claimId));
  }
  revalidatePath(`/e/${token}`);
}

/**
 * Load an event by share token and validate a set of member ids against its
 * participants. Group actions are gated the same way as every other write:
 * a signed-in session plus the share token. Throws on any problem.
 */
async function requireEventForGroup(token: string, memberIds: number[]) {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) throw new Error("Event not found");
  const validIds = new Set(detail.participants.map((p) => p.id));
  const members = [...new Set(memberIds)].filter((id) => validIds.has(id));
  if (members.length === 0) throw new Error("A group needs at least one member");
  return { detail, members };
}

export async function createGroupAction(
  token: string,
  name: string,
  memberIds: number[],
): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Group name is required");
  const { detail, members } = await requireEventForGroup(token, memberIds);

  const [group] = await db
    .insert(groups)
    .values({ eventId: detail.event.id, name: trimmed })
    .returning();
  await db
    .insert(participantGroup)
    .values(members.map((participantId) => ({ groupId: group.id, participantId })));

  revalidatePath(`/e/${token}`);
  return group.id;
}

export async function updateGroupAction(
  token: string,
  groupId: number,
  name: string,
  memberIds: number[],
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Group name is required");
  const { detail, members } = await requireEventForGroup(token, memberIds);

  // The group must belong to this event, not just any event.
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!group || group.eventId !== detail.event.id) throw new Error("Group not found");

  await db.update(groups).set({ name: trimmed }).where(eq(groups.id, groupId));
  await db.delete(participantGroup).where(eq(participantGroup.groupId, groupId));
  await db
    .insert(participantGroup)
    .values(members.map((participantId) => ({ groupId, participantId })));

  revalidatePath(`/e/${token}`);
}

export async function deleteGroupAction(token: string, groupId: number): Promise<void> {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) throw new Error("Event not found");

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!group || group.eventId !== detail.event.id) throw new Error("Group not found");

  // `expenseShares.groupId` is set-null on delete, so removing a group that a
  // receipt still splits by would silently drop that receipt's shares from the
  // balances. Block it and make the user reassign first.
  const [inUse] = await db
    .select({ id: expenseShares.id })
    .from(expenseShares)
    .where(eq(expenseShares.groupId, groupId))
    .limit(1);
  if (inUse) {
    throw new Error("This group is used by a receipt — reassign it before deleting");
  }

  await db.delete(groups).where(eq(groups.id, groupId));
  revalidatePath(`/e/${token}`);
}
