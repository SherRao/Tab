import { beforeAll, describe, expect, it, vi } from "vitest";
import { hasDb } from "./test-db";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));


let currentUser: { id: number; email: string; username: string; displayName: string } | null = null;
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSession: async (nextPath?: string) => {
      if (!currentUser) throw new Error(`NEXT_REDIRECT:${nextPath ?? "/signin"}`);
      return { ...currentUser };
    },
    getSessionUser: async () => (currentUser ? { ...currentUser } : null),
  };
});

let dbModule: typeof import("@/db");
let schema: typeof import("@/db/schema");
let actions: typeof import("@/lib/actions");
let queries: typeof import("@/lib/queries");

async function seedUser(email: string, username: string) {
  const [row] = await dbModule.db
    .insert(schema.users)
    .values({ email, username, displayName: username })
    .returning();
  return row;
}

beforeAll(async () => { if (!hasDb) return;
  dbModule = await import("@/db");
  await dbModule.runMigrations();
  schema = await import("@/db/schema");
  actions = await import("@/lib/actions");
  queries = await import("@/lib/queries");
});

async function setupEvent() {
  const owner = await seedUser(`o-${Date.now()}@t.dev`, `o${Date.now()}`);
  const friend = await seedUser(`f-${Date.now()}@t.dev`, `f${Date.now()}`);

  const [event] = await dbModule.db
    .insert(schema.events)
    .values({ name: "Trip", shareToken: `tok-${Date.now()}-${Math.random()}` })
    .returning();
  const [ownerP] = await dbModule.db
    .insert(schema.participants)
    .values({ eventId: event.id, name: "Owner", userId: owner.id })
    .returning();
  const [friendP] = await dbModule.db
    .insert(schema.participants)
    .values({ eventId: event.id, name: "Friend", userId: friend.id })
    .returning();
  const [guestP] = await dbModule.db
    .insert(schema.participants)
    .values({ eventId: event.id, name: "Guest" })
    .returning();
  return { event, owner, friend, ownerP, friendP, guestP };
}

describe.skipIf(!hasDb)("createPaymentAction", () => {
  it("rejects an unclaimed viewer", async () => {
    const { event, friendP } = await setupEvent();
    currentUser = null;
    await expect(
      actions.createPaymentAction(event.shareToken, {
        toParticipantId: friendP.id,
        amountCents: 1000,
      }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("rejects a signed-in user with no linked participant on this event", async () => {
    const { event, friendP } = await setupEvent();
    const stranger = await seedUser(`x-${Date.now()}@t.dev`, `x${Date.now()}`);
    currentUser = { id: stranger.id, email: stranger.email, username: stranger.username, displayName: stranger.displayName };
    await expect(
      actions.createPaymentAction(event.shareToken, {
        toParticipantId: friendP.id,
        amountCents: 1000,
      }),
    ).rejects.toThrow(/claim your participant/);
  });

  it("inserts a payment for a claimed payer and derives 'from' from the session", async () => {
    const { event, owner, ownerP, friendP } = await setupEvent();
    currentUser = { id: owner.id, email: owner.email, username: owner.username, displayName: owner.displayName };
    await actions.createPaymentAction(event.shareToken, {
      toParticipantId: friendP.id,
      amountCents: 2500,
      note: " cash ",
    });
    const rows = await queries.getPaymentsForEvent(event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromParticipantId: ownerP.id,
      toParticipantId: friendP.id,
      amountCents: 2500,
      note: "cash",
    });
  });

  it("rejects to === from and non-participant recipients", async () => {
    const { event, owner, ownerP } = await setupEvent();
    currentUser = { id: owner.id, email: owner.email, username: owner.username, displayName: owner.displayName };
    await expect(
      actions.createPaymentAction(event.shareToken, {
        toParticipantId: ownerP.id,
        amountCents: 100,
      }),
    ).rejects.toThrow(/yourself/);
    await expect(
      actions.createPaymentAction(event.shareToken, {
        toParticipantId: 99999,
        amountCents: 100,
      }),
    ).rejects.toThrow(/not a participant/);
  });

  it("rejects zero, negative, and out-of-range amounts", async () => {
    const { event, owner, friendP } = await setupEvent();
    currentUser = { id: owner.id, email: owner.email, username: owner.username, displayName: owner.displayName };
    for (const amt of [0, -1, 100_000_001, 1.5]) {
      await expect(
        actions.createPaymentAction(event.shareToken, {
          toParticipantId: friendP.id,
          amountCents: amt,
        }),
      ).rejects.toThrow(/Amount/);
    }
  });
});

describe.skipIf(!hasDb)("updatePaymentAction / deletePaymentAction", () => {
  it("payer can edit and delete their own payment", async () => {
    const { event, owner, ownerP, friendP } = await setupEvent();
    currentUser = { id: owner.id, email: owner.email, username: owner.username, displayName: owner.displayName };
    await actions.createPaymentAction(event.shareToken, {
      toParticipantId: friendP.id,
      amountCents: 3000,
    });
    const [row] = await queries.getPaymentsForEvent(event.id);
    await actions.updatePaymentAction(event.shareToken, row.id, { amountCents: 2000, note: "venmo" });
    const [after] = await dbModule.db.select().from(schema.payments).where(eq(schema.payments.id, row.id));
    expect(after.amountCents).toBe(2000);
    expect(after.note).toBe("venmo");
    expect(after.fromParticipantId).toBe(ownerP.id);

    await actions.deletePaymentAction(event.shareToken, row.id);
    expect(await queries.getPaymentsForEvent(event.id)).toEqual([]);
  });

  it("non-payer cannot edit or delete", async () => {
    const { event, owner, friend, friendP } = await setupEvent();
    currentUser = { id: owner.id, email: owner.email, username: owner.username, displayName: owner.displayName };
    await actions.createPaymentAction(event.shareToken, {
      toParticipantId: friendP.id,
      amountCents: 3000,
    });
    const [row] = await queries.getPaymentsForEvent(event.id);

    currentUser = { id: friend.id, email: friend.email, username: friend.username, displayName: friend.displayName };
    await expect(
      actions.updatePaymentAction(event.shareToken, row.id, { amountCents: 10 }),
    ).rejects.toThrow(/Only the payer/);
    await expect(
      actions.deletePaymentAction(event.shareToken, row.id),
    ).rejects.toThrow(/Only the payer/);
  });
});
