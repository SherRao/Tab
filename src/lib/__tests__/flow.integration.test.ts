import { beforeAll, describe, expect, it, vi } from "vitest";
import { hydrateTotalShares } from "@/lib/expense-hydrate";
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
    expenseRows.map(({ expense, items, shares }) => ({
      payerId: expense.payerId,
      taxCents: expense.taxCents,
      tipCents: expense.tipCents,
      totalCents: expense.totalCents,
      splitMode: expense.splitMode as "itemized" | "even",
      lineItems: items.map((i) => ({
        id: i.item.id,
        name: i.item.name,
        amountCents: i.item.amountCents,
        participantIds: i.participantIds,
      })),
      shares: shares.map((s) => ({
        participantId: s.participantId ?? undefined,
        groupId: s.groupId ?? undefined,
        lineItemId: s.lineItemId ?? undefined,
        weightType: s.weightType,
        weightValue: s.weightValue,
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
  it("creates an event when the creator adds one other participant", async () => {
    const form = new FormData();
    form.set("name", "Two people");
    form.set("participants", "Solo");
    await actions.createEventAction(form);
    expect(redirectMock).toHaveBeenCalledWith(expect.stringMatching(/^\/e\/[A-Za-z0-9_-]+$/));
  });

  it("creates an event with a share link at /e/<token>", async () => {
    const form = new FormData();
    form.set("name", "Form Event");
    form.set("participants", "Alice, Bob");
    await actions.createEventAction(form);
    expect(redirectMock).toHaveBeenCalledWith(expect.stringMatching(/^\/e\/[A-Za-z0-9_-]+$/));
  });

  it("exploration scenario: one payer, mixed assignments, even expense", async () => {
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
      items: [
        { name: "Tacos", amountCents: 2400, participantIds: [A, B] },
        { name: "Guac", amountCents: 800, participantIds: [A, C] },
      ],
      shares: [],
    });
    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Group dinner",
      taxCents: 0,
      tipCents: 0,
      totalCents: 9000,
      splitMode: "even",
      items: [],
      shares: [
        { participantId: A, weightType: "equal", weightValue: 10000 },
        { participantId: B, weightType: "equal", weightValue: 10000 },
        { participantId: C, weightType: "equal", weightValue: 10000 },
      ],
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
      description: "Even split expense",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      items: [],
      shares: [
        { participantId: A, weightType: "equal", weightValue: 10000 },
        { participantId: B, weightType: "equal", weightValue: 10000 },
        { participantId: C, weightType: "equal", weightValue: 10000 },
      ],
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

    const evenExpense = expenseRows.find((r) => r.expense.description === "Even split expense")!;
    const deleteForm = new FormData();
    deleteForm.set("token", event.shareToken);
    deleteForm.set("expenseId", String(evenExpense.expense.id));
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
        items: [],
        shares: detail!.participants.map((p) => ({
          participantId: p.id,
          weightType: "equal" as const,
          weightValue: 10000,
        })),
      }),
    ).rejects.toThrow("Payer is not a participant");
  });

  it("creates expense with custom percent shares and verifies balances", async () => {
    const { event } = await queries.createEventRecord("Percent Test", ["Alice", "Bob"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B] = detail!.participants.map((p) => p.id);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Custom split",
      taxCents: 0,
      tipCents: 0,
      totalCents: 10000,
      splitMode: "even",
      items: [],
      shares: [
        { participantId: A, weightType: "percent", weightValue: 7000 },
        { participantId: B, weightType: "percent", weightValue: 3000 },
      ],
    });

    const expenseRows = await queries.getExpenses(event.id);
    const nets = toLedger(detail!, expenseRows);
    // Alice paid 10000, consumed 7000 (70%), Bob consumed 3000 (30%)
    expect(nets.get(A)).toBe(3000);
    expect(nets.get(B)).toBe(-3000);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("validates percent shares must sum to 100%", async () => {
    const { event } = await queries.createEventRecord("Validation Test", ["Alice", "Bob"]);
    await expect(
      actions.saveExpenseAction(event.shareToken, {
        payerId: (await queries.getEventByToken(event.shareToken))!.participants[0].id,
        description: "Bad percents",
        taxCents: 0,
        tipCents: 0,
        totalCents: 10000,
        splitMode: "even",
        items: [],
        shares: [
          { participantId: 1, weightType: "percent", weightValue: 6000 },
          { participantId: 2, weightType: "percent", weightValue: 3000 },
        ],
      }),
    ).rejects.toThrow("Percent shares must sum to 100%");
  });

  // Regression: itemized per-item weights were emitted with lineItemId null and
  // never backfilled, so the ledger's itemized branch dropped every line item.
  it("keeps line-item consumption when quantity weights are used", async () => {
    const { event } = await queries.createEventRecord("Quantity Split", ["Alice", "Bob"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B] = detail!.participants.map((p) => p.id);

    // One $30 item, Alice took 2 of 3 units, Bob 1.
    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Shared platter",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "itemized",
      items: [{ name: "Platter", amountCents: 3000, participantIds: [A, B] }],
      shares: [
        { participantId: A, itemIndex: 0, weightType: "percent", weightValue: 6667 },
        { participantId: B, itemIndex: 0, weightType: "percent", weightValue: 3333 },
      ],
    });

    const rows = await queries.getExpenses(event.id);
    // Item-level shares must be anchored to a real line item, not stored as total-level.
    expect(rows[0].shares.every((s) => s.lineItemId != null)).toBe(true);

    const nets = toLedger(detail!, rows);
    expect(nets.get(A)).toBe(1000); // paid 3000, consumed 2000
    expect(nets.get(B)).toBe(-1000);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  // Regression: item-level shares were misread as total-level by the validator,
  // so a second weighted item pushed the percent sum past 100% and threw.
  it("accepts several items that each carry their own percent weights", async () => {
    const { event } = await queries.createEventRecord("Two Weighted Items", ["Alice", "Bob"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B] = detail!.participants.map((p) => p.id);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Two items",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "itemized",
      items: [
        { name: "Wine", amountCents: 2000, participantIds: [A, B] },
        { name: "Bread", amountCents: 1000, participantIds: [A, B] },
      ],
      shares: [
        { participantId: A, itemIndex: 0, weightType: "percent", weightValue: 7500 },
        { participantId: B, itemIndex: 0, weightType: "percent", weightValue: 2500 },
        { participantId: A, itemIndex: 1, weightType: "percent", weightValue: 5000 },
        { participantId: B, itemIndex: 1, weightType: "percent", weightValue: 5000 },
      ],
    });

    const rows = await queries.getExpenses(event.id);
    const nets = toLedger(detail!, rows);
    // Alice: 75% of 2000 + 50% of 1000 = 2000 consumed, paid 3000 -> +1000
    expect(nets.get(A)).toBe(1000);
    expect(nets.get(B)).toBe(-1000);
  });

  // Regression: a total-level share set with no item scope must still be validated.
  it("still rejects total-level percents that miss 100%", async () => {
    const { event } = await queries.createEventRecord("Still Validated", ["Alice", "Bob"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B] = detail!.participants.map((p) => p.id);
    await expect(
      actions.saveExpenseAction(event.shareToken, {
        payerId: A,
        description: "Bad",
        taxCents: 0,
        tipCents: 0,
        totalCents: 10000,
        splitMode: "even",
        items: [],
        shares: [
          { participantId: A, weightType: "percent", weightValue: 6000 },
          { participantId: B, weightType: "percent", weightValue: 3000 },
        ],
      }),
    ).rejects.toThrow("Percent shares must sum to 100%");
  });

  // Regression: the edit page rebuilt every share as "equal", so saving an
  // unrelated field wiped a custom split.
  it("keeps a custom split when an unrelated field is edited", async () => {
    const { event } = await queries.createEventRecord("Edit Keeps Split", ["Alice", "Bob"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B] = detail!.participants.map((p) => p.id);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Original",
      taxCents: 0,
      tipCents: 0,
      totalCents: 10000,
      splitMode: "even",
      items: [],
      shares: [
        { participantId: A, weightType: "percent", weightValue: 7000 },
        { participantId: B, weightType: "percent", weightValue: 3000 },
      ],
    });

    const saved = (await queries.getExpenses(event.id))[0];

    // What the edit page now hands the editor, and what the editor sends back
    // when only the description changed.
    const hydrated = hydrateTotalShares(saved.shares);
    await actions.updateExpenseAction(event.shareToken, saved.expense.id, {
      payerId: A,
      description: "Renamed",
      taxCents: 0,
      tipCents: 0,
      totalCents: 10000,
      splitMode: "even",
      items: [],
      shares: hydrated,
    });

    const after = (await queries.getExpenses(event.id))[0];
    expect(after.expense.description).toBe("Renamed");
    expect(
      after.shares
        .filter((s) => s.lineItemId == null)
        .map((s) => [s.participantId, s.weightType, s.weightValue])
        .sort(),
    ).toEqual([
      [A, "percent", 7000],
      [B, "percent", 3000],
    ].sort());

    const nets = toLedger(detail!, [after]);
    expect(nets.get(A)).toBe(3000);
    expect(nets.get(B)).toBe(-3000);
  });

  // The editor now emits equal item-level shares where it previously sent none.
  // Balances must match the old no-shares fallback exactly, tax and tip included.
  it("matches the legacy fallback when items are split equally", async () => {
    async function netsFor(name: string, withShares: boolean) {
      const { event } = await queries.createEventRecord(name, ["Alice", "Bob", "Cara"]);
      const detail = await queries.getEventByToken(event.shareToken);
      const [A, B, C] = detail!.participants.map((p) => p.id);
      await actions.saveExpenseAction(event.shareToken, {
        payerId: A,
        description: "Dinner",
        taxCents: 500,
        tipCents: 700,
        totalCents: 5200,
        splitMode: "itemized",
        items: [
          { name: "Pasta", amountCents: 2000, participantIds: [A, B] },
          { name: "Salad", amountCents: 2000, participantIds: [C] },
        ],
        shares: withShares
          ? [
              { participantId: A, itemIndex: 0, weightType: "equal", weightValue: 10000 },
              { participantId: B, itemIndex: 0, weightType: "equal", weightValue: 10000 },
              { participantId: C, itemIndex: 1, weightType: "equal", weightValue: 10000 },
            ]
          : [],
      });
      const nets = toLedger(detail!, await queries.getExpenses(event.id));
      return [nets.get(A), nets.get(B), nets.get(C)];
    }

    const legacy = await netsFor("Legacy Fallback", false);
    const current = await netsFor("Equal Item Shares", true);
    expect(current).toEqual(legacy);
    expect(current.reduce((a, b) => a! + b!, 0)).toBe(0);
  });
});
