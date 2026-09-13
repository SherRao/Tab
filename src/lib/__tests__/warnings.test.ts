import { describe, expect, it } from "vitest";
import { unassignedItemWarnings, type WarningExpenseRow } from "../warnings";

const row = (over: Partial<WarningExpenseRow>): WarningExpenseRow => ({
  expense: { description: "Dinner", splitMode: "itemized" },
  items: [],
  shares: [],
  ...over,
});

describe("unassignedItemWarnings", () => {
  it("warns for an item with no expense_shares row", () => {
    const w = unassignedItemWarnings([
      row({
        items: [{ item: { id: 1, name: "Fries" } }],
        shares: [],
      }),
    ]);
    expect(w).toEqual(['"Fries" in "Dinner" has no assignees']);
  });

  it("does not warn for an item that has an expense_shares row (C2)", () => {
    // The dangerous case: line_item_shares absent but expense_shares present.
    const w = unassignedItemWarnings([
      row({
        items: [{ item: { id: 1, name: "Fries" } }],
        shares: [{ lineItemId: 1 }],
      }),
    ]);
    expect(w).toEqual([]);
  });

  it("ignores even-mode receipts", () => {
    const w = unassignedItemWarnings([
      row({
        expense: { description: "Cab", splitMode: "even" },
        items: [{ item: { id: 1, name: "Ride" } }],
        shares: [],
      }),
    ]);
    expect(w).toEqual([]);
  });

  it("falls back to 'Untitled' for a missing description", () => {
    const w = unassignedItemWarnings([
      row({
        expense: { description: null, splitMode: "itemized" },
        items: [{ item: { id: 9, name: "Mystery" } }],
      }),
    ]);
    expect(w).toEqual(['"Mystery" in "Untitled" has no assignees']);
  });
});
