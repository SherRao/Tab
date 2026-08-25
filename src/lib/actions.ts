"use server";

import { db } from "@/db";
import {
  expenses,
  lineItemShares,
  lineItems,
  participantClaims,
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
      redirect("/?error=1");
    }
  } else {
    entries = rawLegacy
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ mode: "guest" as const, name: n }));
  }

  if (!name || entries.length < 2) {
    redirect("/?error=1");
  }

  const { event, participants: created } = await createEventRecord(name, entries, user.id);

  try {
    await addParticipantRow(event.id, { mode: "account", userId: user.id });
} catch {
    await addParticipantRow(event.id, { mode: "guest", name: user.displayName ?? user.username ?? "You" });
}

  // Send invitation emails for any invited participants created up front.
  for (const person of created) {
    if (person.email == null) continue;
    const token = await createLoginToken(person.email, person.id);
    await sendEmail({
      to: person.email,
      subject: `You're on "${event.name}" — join your tab`,
      text: invitationEmailBody(event.name, token, `/e/${event.shareToken}`),
    });
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
          : { mode: "guest", name: String(parsed.name ?? "") };
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

interface ExpensePayload {
  payerId: number;
  description: string;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  splitMode: SplitMode;
  groupIds: number[] | undefined;
  items: { name: string; amountCents: number; participantIds: number[] }[];
}

export async function saveExpenseAction(token: string, payload: ExpensePayload) {
  await requireSession();
  const detail = await getEventByToken(token);
  if (!detail) throw new Error("Event not found");
  if (!SPLIT_MODES.includes(payload.splitMode)) throw new Error("Invalid split mode");
  const validIds = new Set(detail.participants.map((p) => p.id));
  if (!validIds.has(payload.payerId)) throw new Error("Payer is not a participant of this event");

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
      groupIds:
        payload.splitMode === "even"
          ? payload.groupIds?.filter((id) => validIds.has(id))
          : undefined,
    })
    .returning();

  for (const item of payload.items) {
    const [row] = await db
      .insert(lineItems)
      .values({
        expenseId: expense.id,
        name: item.name,
        amountCents: item.amountCents,
      })
      .returning();
    const shares = [...new Set(item.participantIds)].filter((id) => validIds.has(id));
    if (shares.length) {
      await db
        .insert(lineItemShares)
        .values(shares.map((participantId) => ({ lineItemId: row.id, participantId })));
    }
  }

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

  await db
    .update(expenses)
    .set({
      payerId: payload.payerId,
      description: payload.description,
      taxCents: payload.taxCents,
      tipCents: payload.tipCents,
      totalCents: payload.totalCents,
      splitMode: payload.splitMode,
      groupIds: payload.splitMode === "even" ? (payload.groupIds ?? undefined) : undefined,
    })
    .where(eq(expenses.id, expenseId));

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

  for (const item of payload.items) {
    const [row] = await db
      .insert(lineItems)
      .values({ expenseId, name: item.name, amountCents: item.amountCents })
      .returning();
    const shares = [...new Set(item.participantIds)];
    if (shares.length) {
      await db
        .insert(lineItemShares)
        .values(shares.map((participantId) => ({ lineItemId: row.id, participantId })));
    }
  }

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

  await db.delete(events).where(eq(events.shareToken, token));
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
    .select()
    .from(participantClaims)
    .where(and(eq(participantClaims.id, claimId), eq(participantClaims.status, "pending")));
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
