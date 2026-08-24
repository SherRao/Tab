"use server";

import { db } from "@/db";
import {
  expenses,
  lineItemShares,
  lineItems,
  SPLIT_MODES,
  type SplitMode,
} from "@/db/schema";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import {
  createEventRecord,
  addParticipantRecord,
  getEventByToken,
} from "./queries";

export async function createEventAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const raw = String(formData.get("participants") ?? "");
  const names = raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (!name || names.length < 2) {
    redirect("/?error=1");
  }
  const event = await createEventRecord(name, names);
  revalidatePath("/");
  redirect(`/e/${event.shareToken}`);
}

export async function addParticipantAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const detail = await getEventByToken(token);
  if (detail && name) {
    await addParticipantRecord(detail.event.id, name);
    revalidatePath(`/e/${token}`);
  }
}

interface ExpensePayload {
  payerId: number;
  description: string;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  splitMode: SplitMode;
  evenParticipantIds: number[];
  items: { name: string; amountCents: number; participantIds: number[] }[];
}

export async function saveExpenseAction(token: string, payload: ExpensePayload) {
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
      evenParticipantIds:
        payload.splitMode === "even" ? payload.evenParticipantIds.filter((id) => validIds.has(id)) : null,
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
      evenParticipantIds:
        payload.splitMode === "even" ? payload.evenParticipantIds : null,
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
