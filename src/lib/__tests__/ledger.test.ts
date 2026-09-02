import { describe, expect, it } from "vitest";
import {
  allocateByWeights,
  computeNetBalances,
  computeParticipantBreakdown,
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
          lineItems: [],
          shares: [
            { participantId: 1, weightType: "equal", weightValue: 10000 },
            { participantId: 2, weightType: "equal", weightValue: 10000 },
          ],
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

  it("even mode with shares divides total equally among selected participants", () => {
    const nets = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          lineItems: [],
          shares: [
            { participantId: 1, weightType: "equal", weightValue: 10000 },
            { participantId: 2, weightType: "equal", weightValue: 10000 },
            { participantId: 3, weightType: "equal", weightValue: 10000 },
          ],
        },
      ],
    );
    expect(nets.get(1)).toBe(6000);
    expect(nets.get(2)).toBe(-3000);
    expect(nets.get(3)).toBe(-3000);
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
        lineItems: [],
        shares: [
          { participantId: 2, weightType: "equal", weightValue: 10000 },
          { participantId: 4, weightType: "equal", weightValue: 10000 },
        ],
      },
    ];
    const nets = computeNetBalances([alice, bob, carol, dave], expenses);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("percent shares divide proportionally", () => {
    const nets = computeNetBalances(
      [alice, bob],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          lineItems: [],
          shares: [
            { participantId: 1, weightType: "percent", weightValue: 6000 },
            { participantId: 2, weightType: "percent", weightValue: 4000 },
          ],
        },
      ],
    );
    // Alice paid 9000, consumed 5400 (60%), Bob consumed 3600 (40%)
    expect(nets.get(1)).toBe(3600);
    expect(nets.get(2)).toBe(-3600);
  });

  it("amount shares assign exact cents", () => {
    const nets = computeNetBalances(
      [alice, bob],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 6056,
          splitMode: "even",
          lineItems: [],
          shares: [
            { participantId: 1, weightType: "amount", weightValue: 4000 },
            { participantId: 2, weightType: "amount", weightValue: 2056 },
          ],
        },
      ],
    );
    expect(nets.get(1)).toBe(2056);
    expect(nets.get(2)).toBe(-2056);
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

describe("mixed weight types", () => {
  const alice = P(1, "Alice");
  const bob = P(2, "Bob");
  const carol = P(3, "Carol");

  it("amount + percent: exact amounts first, remainder proportional", () => {
    // Total 10000 cents. Carol gets $40 (4000 cents exact), Alice 60%, Bob 40% of remainder
    const nets = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 10000,
          splitMode: "even",
          lineItems: [],
          shares: [
            { participantId: 3, weightType: "amount", weightValue: 4000 },
            { participantId: 1, weightType: "percent", weightValue: 6000 },
            { participantId: 2, weightType: "percent", weightValue: 4000 },
          ],
        },
      ],
    );
    // Alice paid 10000, consumed: 3600 (60% of 6000 remainder)
    // Bob consumed: 2400 (40% of 6000 remainder)
    // Carol consumed: 4000 (exact)
    expect(nets.get(1)).toBe(10000 - 3600);
    expect(nets.get(2)).toBe(-2400);
    expect(nets.get(3)).toBe(-4000);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("mixed weights sum to total consumed", () => {
    const nets = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          lineItems: [],
          shares: [
            { participantId: 1, weightType: "equal", weightValue: 10000 },
            { participantId: 2, weightType: "percent", weightValue: 5000 },
            { participantId: 3, weightType: "amount", weightValue: 3000 },
          ],
        },
      ],
    );
    // Carol gets 3000 exact, Alice gets 2/3 of remaining 6000 = 4000, Bob gets 1/3 = 2000
    expect(nets.get(1)).toBe(9000 - 4000);
    expect(nets.get(2)).toBe(-2000);
    expect(nets.get(3)).toBe(-3000);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("live group resolution", () => {
  const alice = P(1, "Alice");
  const bob = P(2, "Bob");
  const carol = P(3, "Carol");

  it("group reference resolves to current members at compute time", () => {
    const groupMembers = new Map<number, number[]>([[100, [1, 2]]]); // Group 100 = Alice, Bob
    const lookup = (gid: number) => groupMembers.get(gid) ?? [];

    const nets = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          lineItems: [],
          shares: [{ groupId: 100, weightType: "equal", weightValue: 10000 }],
        },
      ],
      lookup,
    );
    // Group 100 = Alice + Bob. Each gets 4500.
    expect(nets.get(1)).toBe(4500);
    expect(nets.get(2)).toBe(-4500);
    expect(nets.get(3)).toBe(0);
  });

  it("adding member to group updates past balances", () => {
    // First compute with Alice+Bob in group
    const groupBefore = new Map<number, number[]>([[100, [1, 2]]]);
    const lookupBefore = (gid: number) => groupBefore.get(gid) ?? [];
    const netsBefore = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          lineItems: [],
          shares: [{ groupId: 100, weightType: "equal", weightValue: 10000 }],
        },
      ],
      lookupBefore,
    );
    expect(netsBefore.get(1)).toBe(4500);
    expect(netsBefore.get(2)).toBe(-4500);
    expect(netsBefore.get(3)).toBe(0);

    // Now add Carol to group
    const groupAfter = new Map<number, number[]>([[100, [1, 2, 3]]]);
    const lookupAfter = (gid: number) => groupAfter.get(gid) ?? [];
    const netsAfter = computeNetBalances(
      [alice, bob, carol],
      [
        {
          payerId: 1,
          taxCents: 0,
          tipCents: 0,
          totalCents: 9000,
          splitMode: "even",
          lineItems: [],
          shares: [{ groupId: 100, weightType: "equal", weightValue: 10000 }],
        },
      ],
      lookupAfter,
    );
    // Each of 3 people gets 3000
    expect(netsAfter.get(1)).toBe(6000);
    expect(netsAfter.get(2)).toBe(-3000);
    expect(netsAfter.get(3)).toBe(-3000);
    expect([...netsAfter.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("computeParticipantBreakdown parity", () => {
  const alice = P(1, "Alice");
  const bob = P(2, "Bob");
  const carol = P(3, "Carol");

  it("breakdown totals reconcile with computeConsumption for weighted shares", () => {
    const expenses: LedgerExpense[] = [
      {
        payerId: 1,
        taxCents: 500,
        tipCents: 300,
        totalCents: 9800,
        splitMode: "even",
        lineItems: [],
        shares: [
          { participantId: 1, weightType: "percent", weightValue: 6000 },
          { participantId: 2, weightType: "percent", weightValue: 4000 },
        ],
      },
    ];

    const nets = computeNetBalances([alice, bob, carol], expenses);
    const bAlice = computeParticipantBreakdown([alice, bob, carol], expenses, 1);
    const bBob = computeParticipantBreakdown([alice, bob, carol], expenses, 2);
    const bCarol = computeParticipantBreakdown([alice, bob, carol], expenses, 3);

    // Breakdown net should equal net balance
    expect(bAlice.netCents).toBe(nets.get(1));
    expect(bBob.netCents).toBe(nets.get(2));
    expect(bCarol.netCents).toBe(nets.get(3));

    // Totals should sum to zero
    expect(bAlice.totalConsumedCents + bBob.totalConsumedCents + bCarol.totalConsumedCents).toBe(
      9800,
    );
  });

  it("breakdown totals reconcile for itemized mode", () => {
    const expenses: LedgerExpense[] = [
      {
        payerId: 1,
        taxCents: 200,
        tipCents: 100,
        totalCents: 3300,
        splitMode: "itemized",
        lineItems: [{ name: "Food", amountCents: 3000, participantIds: [1, 2] }],
      },
    ];

    const nets = computeNetBalances([alice, bob, carol], expenses);
    const bAlice = computeParticipantBreakdown([alice, bob, carol], expenses, 1);
    const bBob = computeParticipantBreakdown([alice, bob, carol], expenses, 2);

    expect(bAlice.netCents).toBe(nets.get(1));
    expect(bBob.netCents).toBe(nets.get(2));
  });
});
