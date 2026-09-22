import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

let queries: typeof import("@/lib/queries");
let dbModule: typeof import("@/db");
let schema: typeof import("@/db/schema");

beforeAll(async () => {
  dbModule = await import("@/db");
  await dbModule.runMigrations();
  queries = await import("@/lib/queries");
  schema = await import("@/db/schema");
});

describe("getPaymentsForEvent", () => {
  it("returns rows for the event ordered by createdAt desc", async () => {
    const [event] = await dbModule.db
      .insert(schema.events)
      .values({ name: "Trip", shareToken: `t-${Date.now()}` })
      .returning();
    const [a] = await dbModule.db
      .insert(schema.participants)
      .values({ eventId: event.id, name: "A" })
      .returning();
    const [b] = await dbModule.db
      .insert(schema.participants)
      .values({ eventId: event.id, name: "B" })
      .returning();

    const now = Date.now();
    await dbModule.db.insert(schema.payments).values({
      eventId: event.id,
      fromParticipantId: b.id,
      toParticipantId: a.id,
      amountCents: 1000,
      note: "cash",
      createdAt: new Date(now - 2000),
    });
    await dbModule.db.insert(schema.payments).values({
      eventId: event.id,
      fromParticipantId: b.id,
      toParticipantId: a.id,
      amountCents: 2500,
      note: null,
      createdAt: new Date(now),
    });

    const rows = await queries.getPaymentsForEvent(event.id);
    expect(rows.map((r) => r.amountCents)).toEqual([2500, 1000]);
  });

  it("returns empty for an event with no payments", async () => {
    const [event] = await dbModule.db
      .insert(schema.events)
      .values({ name: "Empty", shareToken: `e-${Date.now()}` })
      .returning();
    const rows = await queries.getPaymentsForEvent(event.id);
    expect(rows).toEqual([]);
  });
});
