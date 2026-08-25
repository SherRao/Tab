import { beforeAll, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const redirectCalls: string[] = [];
const redirectError = vi.fn((url: string) => {
  redirectCalls.push(url);
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectError(url) }));

process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `delete-event-test-${Date.now()}-${process.pid}.db`)}`;

let queries: typeof import("@/lib/queries");
let actions: typeof import("@/lib/actions");
let dbModule: typeof import("@/db");
let schema: typeof import("@/db/schema");
let ownerId: number;
let strangerId: number;
let sessionUserId: number;

// Session identity resolves lazily so tests can switch between owner and stranger.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  const userFor = (id: number) => ({
    id,
    email: `user${id}@test.dev`,
    username: `user${id}`,
    displayName: `User ${id}`,
  });
  return {
    ...actual,
    requireSession: async () => userFor(sessionUserId),
    getSessionUser: async () => userFor(sessionUserId),
  };
});

beforeAll(async () => {
  dbModule = await import("@/db");
  dbModule.runMigrations();
  queries = await import("@/lib/queries");
  actions = await import("@/lib/actions");
  schema = await import("@/db/schema");

  const [owner] = await dbModule.db
    .insert(schema.users)
    .values({ email: "owner@test.dev", username: "owner", displayName: "Owner" })
    .returning();
  const [stranger] = await dbModule.db
    .insert(schema.users)
    .values({ email: "stranger@test.dev", username: "stranger", displayName: "Stranger" })
    .returning();
  ownerId = owner.id;
  strangerId = stranger.id;
  sessionUserId = ownerId;
});

describe("deleteEventAction", () => {
  it("owner deletes event: cascades all dependent data and kills the share link", async () => {
    const { event } = await queries.createEventRecord(
      "Trip to delete",
      ["Alice", "Bob"],
      ownerId,
    );
    const token = event.shareToken;

    const detail = await queries.getEventByToken(token);
    expect(detail).not.toBeNull();
    const [alice] = detail!.participants.filter((p) => p.name === "Alice");

    await actions.saveExpenseAction(token, {
      payerId: alice.id,
      description: "Dinner",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "itemized",
      groupIds: [],
      items: [{ name: "Tacos", amountCents: 3000, participantIds: [alice.id] }],
    });

    expect(await queries.getExpenses(event.id)).toHaveLength(1);

    await expect(actions.deleteEventAction(token)).rejects.toThrow("NEXT_REDIRECT:/tabs");
    expect(redirectCalls.at(-1)).toBe("/tabs");

    // Share link is invalidated immediately.
    expect(await queries.getEventByToken(token)).toBeNull();

    // Cascade cleanup across every dependent table.
    expect(
      await dbModule.db.select().from(schema.participants).where(eq(schema.participants.eventId, event.id)),
    ).toHaveLength(0);
    expect(
      await dbModule.db.select().from(schema.expenses).where(eq(schema.expenses.eventId, event.id)),
    ).toHaveLength(0);
    expect(await dbModule.db.select().from(schema.lineItems)).toHaveLength(0);
    expect(await dbModule.db.select().from(schema.lineItemShares)).toHaveLength(0);

    // Owner's other events are untouched.
    const remaining = await queries.getOwnedEvents(ownerId);
    expect(remaining.find((e) => e.id === event.id)).toBeUndefined();
  });

  it("non-owner cannot delete: redirected back with error and event survives", async () => {
    const { event } = await queries.createEventRecord(
      "Trip that survives",
      ["Alice", "Bob"],
      ownerId,
    );
    const token = event.shareToken;

    sessionUserId = strangerId;
    await expect(actions.deleteEventAction(token)).rejects.toThrow(
      `NEXT_REDIRECT:/e/${token}?deleteError=only_owner`,
    );
    expect(redirectCalls.at(-1)).toBe(`/e/${token}?deleteError=only_owner`);

    // Event was not deleted by the unauthorized attempt.
    expect(await queries.getEventByToken(token)).not.toBeNull();
    sessionUserId = ownerId;
  });

  it("deleting an unknown token redirects home", async () => {
    await expect(actions.deleteEventAction("no-such-token")).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectCalls.at(-1)).toBe("/");
  });
});
