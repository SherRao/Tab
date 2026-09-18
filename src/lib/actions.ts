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
import { createEventRecord, getEventByToken, getGroupsForEvent } from "./queries";
import {
  requireSession,
  getSessionUser,
  appBaseUrl,
  createLoginToken,
  loginTokenRateOk,
} from "./auth";
import { sendEmail } from "./email";
import {
  addParticipant as addParticipantRow,
  findLinkedParticipant,
  getEventOwnerId,
  linkAccountToParticipant,
  ParticipantError,
  toAddParticipantInput,
  type CreateParticipantEntry,
} from "./participants";
import { DELETE_ERROR_ONLY_OWNER, EVENT_ERRORS } from "./event-errors";

/** Money is integer cents end-to-end; reject anything that would break that. */
function assertSafeCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) {
    throw new Error(`${label} must be a whole number of cents between 0 and 100000000`);
  }
}

// Upper bounds on user input so a single request can't persist unbounded data (C11).
const MAX_PARTICIPANTS = 100;
const MAX_NAME_LEN = 100;
const MAX_EMAIL_LEN = 254; // RFC 5321 address limit
const MAX_DESCRIPTION_LEN = 200;
const MAX_LINE_ITEMS = 200;

/** Reject an expense payload whose text/array sizes exceed the C11 caps. */
function assertPayloadWithinLimits(payload: ExpensePayload) {
  if (payload.description.length > MAX_DESCRIPTION_LEN) throw new Error("Description is too long");
  if (payload.items.length > MAX_LINE_ITEMS) throw new Error("Too many line items");
  for (const item of payload.items) {
    if (item.name.length > MAX_NAME_LEN) throw new Error("Line item name is too long");
  }
}

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
      redirect("/create?error=payload");
    }
  } else {
    entries = rawLegacy
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ mode: "guest" as const, name: n }));
  }

  const oversized = entries.some(
    (e) => (e.name?.length ?? 0) > MAX_NAME_LEN || (e.email?.length ?? 0) > MAX_EMAIL_LEN,
  );
  if (!name || name.length > MAX_NAME_LEN || entries.length < 1 || entries.length > MAX_PARTICIPANTS || oversized) {
    redirect("/create?error=1");
  }

  let event, created;
  try {
    ({ event, participants: created } = await createEventRecord(name, entries, user.id));
  } catch (e) {
    if (e instanceof ParticipantError) redirect("/create?error=1");
    throw e;
  }

  try {
    await addParticipantRow(event.id, { mode: "account", userId: user.id });
  } catch {
    await addParticipantRow(event.id, {
      mode: "guest",
      name: user.displayName ?? user.username ?? "You",
    });
  }

  // Send invitation emails for any invited participants created up front.
  for (const person of created) {
    if (person.email == null || person.invitedAt == null) continue;
    if (!(await loginTokenRateOk(person.email))) continue;
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
    const input = toAddParticipantInput(parsed);
    if (input.mode === "account" && !Number.isInteger(input.userId)) return;

    const row = await addParticipantRow(detail.event.id, input);
    if (row.email != null && row.invitedAt != null && (await loginTokenRateOk(row.email))) {
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
  items: {
    name: string;
    amountCents: number;
    participantIds: number[];
    quantity?: number;
    participantQuantities?: Record<number, number>;
  }[];
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
 * Runs inside a `db.transaction`, so it uses the synchronous builders.
 */
function insertExpenseShares(
  tx: Pick<typeof db, "insert">,
  expenseId: number,
  shares: ExpensePayload["shares"],
  lineItemIds: number[],
  validParticipantIds: Set<number>,
  validGroupIds: Set<number>,
) {
  if (shares.length === 0) return;
  for (const s of shares) {
    assertSafeCents(s.weightValue, "Share weight");
    if (s.participantId != null && !validParticipantIds.has(s.participantId)) {
      throw new Error("Share references a participant that is not in this event");
    }
    if (s.groupId != null && !validGroupIds.has(s.groupId)) {
      throw new Error("Share references a group that is not in this event");
    }
  }
  tx.insert(expenseShares)
    .values(
      shares.map((s) => ({
        expenseId,
        participantId: s.participantId ?? null,
        groupId: s.groupId ?? null,
        lineItemId:
          s.itemIndex != null ? (lineItemIds[s.itemIndex] ?? null) : (s.lineItemId ?? null),
        weightType: s.weightType,
        weightValue: s.weightValue,
      })),
    )
    .run();
}

export async function saveExpenseAction(token: string, payload: ExpensePayload) {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) throw new Error("Event not found");
  if (!SPLIT_MODES.includes(payload.splitMode)) throw new Error("Invalid split mode");
  const validIds = new Set(detail.participants.map((p) => p.id));
  if (!validIds.has(payload.payerId)) throw new Error("Payer is not a participant of this event");

  assertSafeCents(payload.totalCents, "Total");
  assertSafeCents(payload.taxCents, "Tax");
  assertSafeCents(payload.tipCents, "Tip");
  assertPayloadWithinLimits(payload);
  for (const item of payload.items) {
    assertSafeCents(item.amountCents, "Item amount");
  }

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

  const validGroupIds = new Set((await getGroupsForEvent(detail.event.id)).map((g) => g.id));

  db.transaction((tx) => {
    const [expense] = tx
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
      .returning()
      .all();

    // Line items first: shares scoped to an item need the item's real id.
    const lineItemIds: number[] = [];
    for (const item of payload.items) {
      const [row] = tx
        .insert(lineItems)
        .values({
          expenseId: expense.id,
          name: item.name,
          amountCents: item.amountCents,
          quantity: item.quantity ?? 0,
        })
        .returning()
        .all();
      lineItemIds.push(row.id);
      const shares = [...new Set(item.participantIds)].filter((id) => validIds.has(id));
      if (shares.length) {
        const pq = item.participantQuantities ?? {};
        tx.insert(lineItemShares)
          .values(shares.map((participantId) => ({
            lineItemId: row.id,
            participantId,
            quantity: pq[participantId] ?? 1,
          })))
          .run();
      }
    }

    insertExpenseShares(tx, expense.id, payload.shares, lineItemIds, validIds, validGroupIds);
  });

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

  assertSafeCents(payload.totalCents, "Total");
  assertSafeCents(payload.taxCents, "Tax");
  assertSafeCents(payload.tipCents, "Tip");
  assertPayloadWithinLimits(payload);
  for (const item of payload.items) {
    assertSafeCents(item.amountCents, "Item amount");
  }

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

  const validGroupIds = new Set((await getGroupsForEvent(detail.event.id)).map((g) => g.id));

  db.transaction((tx) => {
    tx.update(expenses)
      .set({
        payerId: payload.payerId,
        description: payload.description,
        taxCents: payload.taxCents,
        tipCents: payload.tipCents,
        totalCents: payload.totalCents,
        splitMode: payload.splitMode,
      })
      .where(eq(expenses.id, expenseId))
      .run();

    tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId)).run();

    // Replace line items before re-inserting shares, so item-scoped shares can
    // point at the new line item ids.
    const oldItems = tx
      .select({ id: lineItems.id })
      .from(lineItems)
      .where(eq(lineItems.expenseId, expenseId))
      .all();
    if (oldItems.length) {
      tx.delete(lineItemShares)
        .where(
          inArray(
            lineItemShares.lineItemId,
            oldItems.map((i) => i.id),
          ),
        )
        .run();
      tx.delete(lineItems).where(eq(lineItems.expenseId, expenseId)).run();
    }

    const lineItemIds: number[] = [];
    for (const item of payload.items) {
      const [row] = tx
        .insert(lineItems)
        .values({ expenseId, name: item.name, amountCents: item.amountCents, quantity: item.quantity ?? 0 })
        .returning()
        .all();
      lineItemIds.push(row.id);
      const shares = [...new Set(item.participantIds)].filter((id) => validIds.has(id));
      if (shares.length) {
        const pq = item.participantQuantities ?? {};
        tx.insert(lineItemShares)
          .values(shares.map((participantId) => ({
            lineItemId: row.id,
            participantId,
            quantity: pq[participantId] ?? 1,
          })))
          .run();
      }
    }

    insertExpenseShares(tx, expenseId, payload.shares, lineItemIds, validIds, validGroupIds);
  });

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
    redirect(`/e/${token}?deleteError=${DELETE_ERROR_ONLY_OWNER}`);
  }

  // expenses.payerId is ON DELETE RESTRICT (src/db/schema.ts), so dependents
  // must be removed before the event cascade reaches participants.
  db.transaction((tx) => {
    tx.delete(expenses).where(eq(expenses.eventId, detail.event.id)).run();
    tx.delete(participants).where(eq(participants.eventId, detail.event.id)).run();
    tx.delete(events).where(eq(events.id, detail.event.id)).run();
  });
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
    redirect(`/e/${token}?claimError=${encodeURIComponent(EVENT_ERRORS.cannotClaim)}`);
  }
  if (await findLinkedParticipant(detail.event.id, user.id)) {
    redirect(`/e/${token}?claimError=${encodeURIComponent(EVENT_ERRORS.alreadyParticipate)}`);
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
    redirect(`/e/${token}?claimError=${encodeURIComponent(EVENT_ERRORS.onlyOwnerCanDecideClaims)}`);
  }

  const [claim] = await db
    .select({
      id: participantClaims.id,
      participantId: participantClaims.participantId,
      requesterUserId: participantClaims.requesterUserId,
    })
    .from(participantClaims)
    .innerJoin(participants, eq(participantClaims.participantId, participants.id))
    .where(
      and(
        eq(participantClaims.id, claimId),
        eq(participantClaims.status, "pending"),
        eq(participants.eventId, detail.event.id),
      ),
    );
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
