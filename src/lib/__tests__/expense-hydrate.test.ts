import { describe, expect, it } from "vitest";
import { hydrateTotalShares } from "@/lib/expense-hydrate";

type Row = Parameters<typeof hydrateTotalShares>[0][number];

function row(over: Partial<Row>): Row {
  return {
    participantId: null,
    groupId: null,
    lineItemId: null,
    weightType: "equal",
    weightValue: 10000,
    ...over,
  } as Row;
}

describe("hydrateTotalShares", () => {
  it("preserves custom percent weights so an edit does not reset them", () => {
    const out = hydrateTotalShares([
      row({ participantId: 1, weightType: "percent", weightValue: 7000 }),
      row({ participantId: 2, weightType: "percent", weightValue: 3000 }),
    ]);
    expect(out).toEqual([
      { participantId: 1, weightType: "percent", weightValue: 7000 },
      { participantId: 2, weightType: "percent", weightValue: 3000 },
    ]);
  });

  it("preserves exact amount weights", () => {
    const out = hydrateTotalShares([
      row({ participantId: 1, weightType: "amount", weightValue: 2500 }),
      row({ participantId: 2, weightType: "amount", weightValue: 7500 }),
    ]);
    expect(out.map((s) => [s.weightType, s.weightValue])).toEqual([
      ["amount", 2500],
      ["amount", 7500],
    ]);
  });

  it("ignores line-item shares and group rows", () => {
    const out = hydrateTotalShares([
      row({ participantId: 1, weightType: "percent", weightValue: 5000 }),
      row({ participantId: 2, lineItemId: 44, weightType: "percent", weightValue: 5000 }),
      row({ groupId: 7 }),
    ]);
    expect(out).toEqual([{ participantId: 1, weightType: "percent", weightValue: 5000 }]);
  });

  it("returns an empty list when there are no shares", () => {
    expect(hydrateTotalShares([])).toEqual([]);
  });
});
