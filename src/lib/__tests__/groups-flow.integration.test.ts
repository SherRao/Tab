import { beforeAll, describe, expect, it, vi } from "vitest";
import os from "node:os";
import { hydrateSelectedGroupIds, hydrateTotalShares } from "@/lib/expense-hydrate";
import path from "node:path";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `groups-test-${Date.now()}-${process.pid}.db`)}`;

let queries: typeof import("@/lib/queries");
let actions: typeof import("@/lib/actions");
let ledger: typeof import("@/lib/ledger");
let ownerId: number;

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  const session = {
    id: 1,
    email: "owner@test.dev",
    username: "owner",
    displayName: "Owner",
  };
  return { ...actual, requireSession: async () => session, getSessionUser: async () => session };
});

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

/** Net balances for an event, resolving group shares live like the event page does. */
async function netsFor(eventId: number, shareToken: string) {
  const detail = await queries.getEventByToken(shareToken);
  const rows = await queries.getExpenses(eventId);
  const lookup = await queries.getGroupMemberLookup(eventId);
  return ledger.computeNetBalances(
    detail!.participants,
    rows.map(({ expense, items, shares }) => ({
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
    lookup,
  );
}

describe("group actions + live resolution", () => {
  it("creates a group and resolves an equal split across its members", async () => {
    const { event } = await queries.createEventRecord(
      "Trip",
      ["Alice", "Bob", "Cara", "Dan"],
      ownerId,
    );
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B, C] = detail!.participants.map((p) => p.id);

    const groupId = await actions.createGroupAction(event.shareToken, "Car A", [A, B, C]);
    const stored = await queries.getGroupsForEvent(event.id);
    expect(stored).toEqual([{ id: groupId, name: "Car A", memberIds: [A, B, C] }]);

    // $30 gas, paid by Alice, split equally among the group.
    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Gas",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      items: [],
      shares: [{ groupId, weightType: "equal", weightValue: 10000 }],
    });

    const nets = await netsFor(event.id, event.shareToken);
    // Alice paid 3000, consumed 1000; Bob and Cara consumed 1000 each; Dan untouched.
    expect(nets.get(A)).toBe(2000);
    expect(nets.get(B)).toBe(-1000);
    expect(nets.get(C)).toBe(-1000);
    expect(nets.get(detail!.participants[3].id)).toBe(0);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("reflects a new group member in a past expense (live link)", async () => {
    const { event } = await queries.createEventRecord("Live Add", ["Alice", "Bob", "Cara"], ownerId);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B, C] = detail!.participants.map((p) => p.id);
    const groupId = await actions.createGroupAction(event.shareToken, "Dinner", [A, B]);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Dinner",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      items: [],
      shares: [{ groupId, weightType: "equal", weightValue: 10000 }],
    });

    // Before: two-way split.
    let nets = await netsFor(event.id, event.shareToken);
    expect(nets.get(A)).toBe(1500);
    expect(nets.get(B)).toBe(-1500);
    expect(nets.get(C)).toBe(0);

    // Add Cara to the group -> the same past expense now splits three ways.
    await actions.updateGroupAction(event.shareToken, groupId, "Dinner", [A, B, C]);
    nets = await netsFor(event.id, event.shareToken);
    expect(nets.get(A)).toBe(2000);
    expect(nets.get(B)).toBe(-1000);
    expect(nets.get(C)).toBe(-1000);
  });

  it("reflects a removed group member in a past expense (live link)", async () => {
    const { event } = await queries.createEventRecord("Live Remove", ["Alice", "Bob", "Cara"], ownerId);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B, C] = detail!.participants.map((p) => p.id);
    const groupId = await actions.createGroupAction(event.shareToken, "All", [A, B, C]);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Brunch",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      items: [],
      shares: [{ groupId, weightType: "equal", weightValue: 10000 }],
    });

    await actions.updateGroupAction(event.shareToken, groupId, "All", [A, B]);
    const nets = await netsFor(event.id, event.shareToken);
    expect(nets.get(A)).toBe(1500);
    expect(nets.get(B)).toBe(-1500);
    expect(nets.get(C)).toBe(0);
  });

  it("rejects an empty name, empty membership, and a cross-event group", async () => {
    const { event } = await queries.createEventRecord("Guards", ["Alice", "Bob"], ownerId);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A] = detail!.participants.map((p) => p.id);

    await expect(actions.createGroupAction(event.shareToken, "  ", [A])).rejects.toThrow(
      "Group name is required",
    );
    await expect(actions.createGroupAction(event.shareToken, "Empty", [])).rejects.toThrow(
      "at least one member",
    );
    // A participant id from another event is filtered out, leaving zero members.
    await expect(actions.createGroupAction(event.shareToken, "Bad", [99999])).rejects.toThrow(
      "at least one member",
    );

    const other = await queries.createEventRecord("Other", ["Zoe"], ownerId);
    const otherDetail = await queries.getEventByToken(other.event.shareToken);
    const groupId = await actions.createGroupAction(event.shareToken, "Real", [A]);
    await expect(
      actions.updateGroupAction(
        other.event.shareToken,
        groupId,
        "Hijack",
        [otherDetail!.participants[0].id],
      ),
    ).rejects.toThrow("Group not found");
  });

  it("deletes an unused group but blocks deleting one a receipt splits by", async () => {
    const { event } = await queries.createEventRecord("Delete", ["Alice", "Bob"], ownerId);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B] = detail!.participants.map((p) => p.id);

    const unused = await actions.createGroupAction(event.shareToken, "Unused", [A, B]);
    await actions.deleteGroupAction(event.shareToken, unused);
    expect(await queries.getGroupsForEvent(event.id)).toEqual([]);

    const used = await actions.createGroupAction(event.shareToken, "Used", [A, B]);
    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Split by group",
      taxCents: 0,
      tipCents: 0,
      totalCents: 2000,
      splitMode: "even",
      items: [],
      shares: [{ groupId: used, weightType: "equal", weightValue: 10000 }],
    });
    await expect(actions.deleteGroupAction(event.shareToken, used)).rejects.toThrow(
      "used by a receipt",
    );
    // Still there.
    expect((await queries.getGroupsForEvent(event.id)).map((g) => g.id)).toEqual([used]);
  });

  it("counts a member in two overlapping selected groups only once", async () => {
    const { event } = await queries.createEventRecord("Overlap", ["Alice", "Bob", "Cara"], ownerId);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B, C] = detail!.participants.map((p) => p.id);
    // Bob is in both groups.
    const g1 = await actions.createGroupAction(event.shareToken, "Left", [A, B]);
    const g2 = await actions.createGroupAction(event.shareToken, "Right", [B, C]);

    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Shared",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      items: [],
      shares: [
        { groupId: g1, weightType: "equal", weightValue: 10000 },
        { groupId: g2, weightType: "equal", weightValue: 10000 },
      ],
    });

    const nets = await netsFor(event.id, event.shareToken);
    // Union is {A, B, C} -> equal thirds, Bob not double-charged.
    expect(nets.get(A)).toBe(2000); // paid 3000, consumed 1000
    expect(nets.get(B)).toBe(-1000);
    expect(nets.get(C)).toBe(-1000);
  });

  it("saves a group plus an explicit outsider the way the editor emits it", async () => {
    const { event } = await queries.createEventRecord("Mixed", ["Alice", "Bob", "Cara"], ownerId);
    const detail = await queries.getEventByToken(event.shareToken);
    const [A, B, C] = detail!.participants.map((p) => p.id);
    const groupId = await actions.createGroupAction(event.shareToken, "Pair", [A, B]);

    // Editor selection: group Pair (A,B) + explicit Cara. buildShares emits the
    // group share plus an explicit share only for the member outside the group.
    await actions.saveExpenseAction(event.shareToken, {
      payerId: A,
      description: "Split three ways",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      items: [],
      shares: [
        { groupId, weightType: "equal", weightValue: 10000 },
        { participantId: C, weightType: "equal", weightValue: 10000 },
      ],
    });

    const rows = await queries.getExpenses(event.id);
    // Edit-page hydration recovers the group + explicit selection.
    expect(hydrateSelectedGroupIds(rows[0].shares)).toEqual([groupId]);
    expect(hydrateTotalShares(rows[0].shares).map((s) => s.participantId)).toEqual([C]);

    const nets = await netsFor(event.id, event.shareToken);
    expect(nets.get(A)).toBe(2000); // paid 3000, consumed 1000
    expect(nets.get(B)).toBe(-1000);
    expect(nets.get(C)).toBe(-1000);
  });
});
