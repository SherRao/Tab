import { beforeAll, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `flow-test-${Date.now()}-${process.pid}.db`)}`;

let queries: typeof import("@/lib/queries");
let actions: typeof import("@/lib/actions");
let ledger: typeof import("@/lib/ledger");
let ownerId: number;

// Sign-in as a real seeded account for all action-level gating.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSession: async () => ({
      id: ownerId,
      email: "owner@test.dev",
      username: "owner",
      displayName: "Owner",
    }),
    getSessionUser: async () => ({
      id: ownerId,
      email: "owner@test.dev",
      username: "owner",
      displayName: "Owner",
    }),
  };
});

function toLedger(
  detail: NonNullable<Awaited<ReturnType<typeof import("@/lib/queries").getEventByToken>>>,
  expenseRows: Awaited<ReturnType<typeof import("@/lib/queries").getExpenses>>,
) {
  return ledger.computeNetBalances(
    detail.participants,
    expenseRows.map(({ expense, items }) => ({
      payerId: expense.payerId,
      taxCents: expense.taxCents,
      tipCents: expense.tipCents,
      totalCents: expense.totalCents,
      splitMode: expense.splitMode,
      evenParticipantIds: expense.evenParticipantIds ?? undefined,
      lineItems: items.map((i) => ({
        name: i.item.name,
        amountCents: i.item.amountCents,
        participantIds: i.participantIds,
      })),
    })),
  );
}

beforeAll(async () => {
  const dbModule = await import("@/db");
  dbModule.runMigrations();
  queries = await import("@/lib/queries");
  actions = await import("@/lib/actions");
  ledger = await import("@/lib/ledger");

  const schema = await import("@/db/schema");
  const [user] = await dbModule.db
    .insert(schema.users)
    .values({ email: "owner@test.dev", username: "owner", displayName: "Owner" })
    .returning();
  ownerId = user.id;
});

describe("full event flow", () => {
  it("rejects event creation with fewer than two participants", async () => {
    const form = new FormData();
    form.set("name", "Bad");
    form.set("participants", "Solo");
    await actions.createEventAction(form);
    expect(redirectMock).toHaveBeenCalledWith("/?error=1");
  });

  it("creates an event with a share link at /e/<token>", async () => {
    const form = new FormData();
    form.set("name", "Form Event");
    form.set("participants", "Alice, Bob");
    await actions.createEventAction(form);
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/e\/[A-Za-z0-9_-]+$/),
    );
  });

  it("exploration scenario: one payer, mixed assignments, birthday expense", async () => {
    const { event } = await queries.createEventRecord("Trip", ["Alice", "Bob", "Carol"]);
    const detail0 = await queries.getEventByToken(event.shareToken);
    const [A, B, C] = detail0!.participants.map((p) => p.id);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Lunch + dinner receipt",
      taxCents: 256,
      tipCents: 600,
      totalCents: 4056,
      splitMode: "itemized",
      evenParticipantIds: [],
      items: [
        { name: "Tacos", amountCents: 2400, participantIds: [A, B] },
        { name: "Guac", amountCents: 800, participantIds: [A, C] },
      ],
    });
    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Group dinner",
      taxCents: 0,
      tipCents: 0,
      totalCents: 9000,
      splitMode: "even",
      evenParticipantIds: [A, B, C],
      items: [],
    });

    let detail = await queries.getEventByToken(event.shareToken);
    let expenseRows = await queries.getExpenses(detail!.event.id);
    let nets = toLedger(detail!, expenseRows);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(nets.get(A)).toBe(8028);
    expect(nets.get(B)).toBe(-4521);
    expect(nets.get(C)).toBe(-3507);

    let transfers = ledger.simplifyDebts(nets);
    expect(transfers).toEqual([
      { fromId: B, toId: A, amountCents: 4521 },
      { fromId: C, toId: A, amountCents: 3507 },
    ]);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: B,
      description: "Birthday dinner for Bob",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "group",
      evenParticipantIds: [],
      items: [{ name: "Cake", amountCents: 3000, participantIds: [] }],
    });

    detail = await queries.getEventByToken(event.shareToken);
    expenseRows = await queries.getExpenses(detail!.event.id);
    nets = toLedger(detail!, expenseRows);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
    transfers = ledger.simplifyDebts(nets);
    expect(transfers).toEqual([
      { fromId: C, toId: A, amountCents: 4507 },
      { fromId: B, toId: A, amountCents: 2521 },
    ]);

    const birthday = expenseRows.find(
      (r) => r.expense.description === "Birthday dinner for Bob",
    )!;
    const deleteForm = new FormData();
    deleteForm.set("token", event.shareToken);
    deleteForm.set("expenseId", String(birthday.expense.id));
    await actions.deleteExpenseAction(deleteForm);
    detail = await queries.getEventByToken(event.shareToken);
    expenseRows = await queries.getExpenses(detail!.event.id);
    expect(expenseRows).toHaveLength(2);

    await queries.addParticipantRecord(detail!.event.id, "Dave");
    detail = await queries.getEventByToken(event.shareToken);
    const dave = detail!.participants.find((p) => p.name === "Dave")!;
    expenseRows = await queries.getExpenses(detail!.event.id);
    const netsAfterDave = toLedger(detail!, expenseRows);
    expect(netsAfterDave.get(dave.id)).toBe(0);
    expect(netsAfterDave.get(A)).toBe(8028);
  });

  it("rejects expenses whose payer is not a participant of the event", async () => {
    const { event } = await queries.createEventRecord("Guard Test", ["X", "Y"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const otherEventPersonId = detail!.participants[0].id + 999;
    await expect(
      actions.saveExpenseAction(event.shareToken, {
        payerId: otherEventPersonId,
        description: "bad",
        taxCents: 0,
        tipCents: 0,
        totalCents: 1000,
        splitMode: "even",
        evenParticipantIds: detail!.participants.map((p) => p.id),
        items: [],
      }),
    ).rejects.toThrow("Payer is not a participant");
  });
});
