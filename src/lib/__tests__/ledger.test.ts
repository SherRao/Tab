import { describe, expect, it } from "vitest";
import {
  allocateByWeights,
  computeNetBalances,
  equalSplit,
  simplifyDebts,
  type LedgerExpense,
  type LedgerParticipant,
} from "../ledger";

const P = (id: number, name: string): LedgerParticipant => ({ id, name });

describe("allocateByWeights", () => {
  it("allocates proportionally: $60 vs $30 with $9 tax gives $6 and $3", () => {
    const result = allocateByWeights(900, [6000, 3000]);
    expect(result).toEqual([600, 300]);
  });

  it("sum of allocations always equals the source amount", () => {
    for (let trial = 0; trial < 200; trial++) {
      const total = Math.floor(Math.random() * 100000);
      const n = 1 + Math.floor(Math.random() * 8);
      const weights = Array.from({ length: n }, () => Math.floor(Math.random() * 10000));
      const alloc = allocateByWeights(total, weights);
      expect(alloc.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("handles negative totals symmetrically", () => {
    const pos = allocateByWeights(101, [1, 1, 2]);
    const neg = allocateByWeights(-101, [1, 1, 2]);
    expect(neg).toEqual(pos.map((v) => -v));
  });

  it("equalSplit distributes remainder cents to earlier participants", () => {
    expect(equalSplit(100, 3)).toEqual([34, 33, 33]);
    expect(equalSplit(90, 3)).toEqual([30, 30, 30]);
  });
});

describe("computeNetBalances", () => {
  const alice = P(1, "Alice");
  const bob = P(2, "Bob");
  const carol = P(3, "Carol");

  it("single expense: payer who consumed part is owed the rest", () => {
    const nets = computeNetBalances(
      [alice, bob],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          evenParticipantIds: [1, 2],
          lineItems: [],
        },
      ],
    );
    expect(nets.get(1)).toBe(4500);
    expect(nets.get(2)).toBe(-4500);
  });

  it("shared $30 line item between two people charges $15 each", () => {
    const nets = computeNetBalances(
      [alice, bob],
      [
        {
          payerId: 3,
          taxCents: 0,
          tipCents: 0,
          totalCents: 3000,
          splitMode: "itemized",
          lineItems: [{ name: "App", amountCents: 3000, participantIds: [1, 2] }],
        },
      ],
    );
    const carolNets = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 3,
          taxCents: 0,
          tipCents: 0,
          totalCents: 3000,
          splitMode: "itemized",
          lineItems: [{ name: "App", amountCents: 3000, participantIds: [1, 2] }],
        },
      ],
    );
    expect(nets.get(1)).toBe(-1500);
    expect(nets.get(2)).toBe(-1500);
    expect(carolNets.get(1)).toBe(-1500);
    expect(carolNets.get(2)).toBe(-1500);
    expect(carolNets.get(3)).toBe(3000);
  });

  it("proportional tax allocation: A $60, B $30, tax $9 -> $6 and $3", () => {
    const nets = computeNetBalances(
      [alice, bob],
      [
        {
          payerId: 1,
          taxCents: 900,
          tipCents: 0,
          totalCents: 9900,
          splitMode: "itemized",
          lineItems: [
            { name: "A food", amountCents: 6000, participantIds: [1] },
            { name: "B food", amountCents: 3000, participantIds: [2] },
          ],
        },
      ],
    );
    expect(nets.get(1)).toBe(9900 - 6600);
    expect(nets.get(2)).toBe(-3300);
  });

  it("even mode divides total equally among selected group IDs", () => {
    const nets = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          groupIds: [1, 2, 3],
          lineItems: [],
        },
      ],
    );
    expect(nets.get(1)).toBe(6000);
    expect(nets.get(2)).toBe(-3000);
    expect(nets.get(3)).toBe(-3000);
  });

  it("group/birthday mode ignores per-item assignments", () => {
    const expense: LedgerExpense = {
      payerId: 1,
      description: "Birthday dinner",
      taxCents: 500,
      tipCents: 1000,
      totalCents: 6500,
      splitMode: "group",
      lineItems: [
        { name: "Steak", amountCents: 4000, participantIds: [2] },
        { name: "Cake", amountCents: 1000, participantIds: [1] },
      ],
    };
    const nets = computeNetBalances([alice, bob, carol], [expense]);
    expect(nets.get(2)).toBe(-2167);
    expect(nets.get(3)).toBe(-2166);
    expect(nets.get(1)).toBe(6500 - 2167);
  });

  it("balances sum to zero across a messy multi-expense event", () => {
    const dave = P(4, "Dave");
    const expenses: LedgerExpense[] = [
      {
        payerId: 1,
        taxCents: 256,
        tipCents: 600,
        totalCents: 4056,
        splitMode: "itemized",
        lineItems: [
          { name: "Tacos", amountCents: 2400, participantIds: [1, 2] },
          { name: "Guac", amountCents: 800, participantIds: [1, 3] },
        ],
      },
      {
        payerId: 4,
        taxCents: 0,
        tipCents: 0,
        totalCents: 2500,
        splitMode: "even",
        evenParticipantIds: [2, 4],
        lineItems: [],
      },
    ];
    const nets = computeNetBalances([alice, bob, carol, dave], expenses);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("simplifyDebts", () => {
  it("cancels a chain: A owes B $10, B owes C $10 -> A pays C $10 only", () => {
    const transfers = simplifyDebts(
      new Map([
        [1, -1000],
        [2, 0],
        [3, 1000],
      ]),
    );
    expect(transfers).toEqual([{ fromId: 1, toId: 3, amountCents: 1000 }]);
  });

  it("multiple debters pay the creditor directly; creditor owes nothing", () => {
    const transfers = simplifyDebts(
      new Map([
        [1, -1000],
        [2, 3000],
        [3, -1500],
        [4, -500],
      ]),
    );
    expect(transfers).toHaveLength(3);
    expect(transfers.every((t) => t.toId === 2)).toBe(true);
    const totals = new Map<number, number>();
    for (const t of transfers) {
      totals.set(t.fromId, (totals.get(t.fromId) ?? 0) - t.amountCents);
      totals.set(t.toId, (totals.get(t.toId) ?? 0) + t.amountCents);
    }
    expect(totals.get(1)).toBe(-1000);
    expect(totals.get(3)).toBe(-1500);
    expect(totals.get(4)).toBe(-500);
  });

  it("settled event produces no transfers", () => {
    expect(simplifyDebts(new Map([[1, 0]]))).toEqual([]);
  });

  it("transfers settle all debts exactly", () => {
    const nets = new Map([
      [1, -3333],
      [2, -3333],
      [3, -3334],
      [4, 10000],
    ]);
    const transfers = simplifyDebts(nets);
    expect(transfers.length).toBeLessThanOrEqual(3);
    const settled = new Map(nets);
    for (const t of transfers) {
      settled.set(t.fromId, settled.get(t.fromId)! + t.amountCents);
      settled.set(t.toId, settled.get(t.toId)! - t.amountCents);
    }
    for (const v of settled.values()) expect(v).toBe(0);
  });
});
