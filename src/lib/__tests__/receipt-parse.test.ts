import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReceipt } from "../receipt-parse";

const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "../__fixtures__/receipts", name), "utf8");

describe("parseReceipt", () => {
  it("parses a clean receipt fully", () => {
    const draft = parseReceipt(fixture("clean.txt"));
    expect(draft.items).toEqual([
      { name: "2x Latte", amountCents: 900 },
      { name: "1x Croissant", amountCents: 425 },
      { name: "Avocado Toast", amountCents: 1250 },
    ]);
    expect(draft.taxCents).toBe(206);
    expect(draft.tipCents).toBe(400);
    expect(draft.totalCents).toBe(3181);
    expect(draft.usable).toBe(true);
    expect(draft.confidence).toBe(1);
  });

  it("parses a no-tip receipt and ignores payment footer lines", () => {
    const draft = parseReceipt(fixture("no-tip.txt"));
    expect(draft.items).toEqual([
      { name: "3x Street Tacos", amountCents: 1050 },
      { name: "Chips & Guac", amountCents: 675 },
      { name: "2x Horchata", amountCents: 700 },
      { name: "Margarita Pitcher", amountCents: 2200 },
    ]);
    expect(draft.taxCents).toBe(370);
    expect(draft.tipCents).toBe(0);
    expect(draft.totalCents).toBe(4995);
    expect(draft.items.some((i) => /^(cash|change)/i.test(i.name))).toBe(false);
  });

  it("handles comma-decimal amounts", () => {
    const draft = parseReceipt(fixture("comma-decimal.txt"));
    expect(draft.items).toEqual([
      { name: "Spaghetti", amountCents: 1850 },
      { name: "Tiramisu", amountCents: 900 },
      { name: "Sparkling Water", amountCents: 500 },
    ]);
    expect(draft.taxCents).toBe(293);
    expect(draft.tipCents).toBe(488);
    expect(draft.totalCents).toBe(4031);
  });

  it("treats 'Total Nachos' as an item, not the grand total", () => {
    const draft = parseReceipt(fixture("total-named-items.txt"));
    expect(draft.items).toContainEqual({ name: "Total Nachos", amountCents: 1125 });
    expect(draft.items).toContainEqual({ name: "2x Total Taos", amountCents: 950 });
    expect(draft.items).toContainEqual({ name: "Guacamole", amountCents: 800 });
    expect(draft.totalCents).toBe(3722);
    expect(draft.taxCents).toBe(231);
    expect(draft.tipCents).toBe(616);
    expect(draft.usable).toBe(true);
  });

  it("marks an unreadable receipt as unusable", () => {
    const draft = parseReceipt(fixture("unreadable.txt"));
    expect(draft.items).toHaveLength(0);
    expect(draft.totalCents).toBe(0);
    expect(draft.usable).toBe(false);
    expect(draft.confidence).toBe(0);
  });

  it("uses the last total-labeled line when several exist", () => {
    const draft = parseReceipt("Subtotal 10.00\nTotal 5.00\nTotal 15.00\n");
    expect(draft.totalCents).toBe(1500);
  });

  it("classifies tip-only + 'Total Due' receipts without creating line items", () => {
    const draft = parseReceipt(fixture("tip-total-only.txt"));
    expect(draft.items).toHaveLength(0);
    expect(draft.tipCents).toBe(400);
    expect(draft.totalCents).toBe(3181);
    expect(draft.usable).toBe(true);
  });

  it("handles label variants: parentheticals, 'Suggested Tip', 'Due', 'Tax Due'", () => {
    expect(parseReceipt("Tip (18%) 4.00").tipCents).toBe(400);
    expect(parseReceipt("Suggested Tip 4.00").tipCents).toBe(400);
    expect(parseReceipt("Due 31.81").totalCents).toBe(3181);
    expect(parseReceipt("Tax Due 2.06").taxCents).toBe(206);
    expect(parseReceipt("Amount Due 31.81").totalCents).toBe(3181);
    for (const line of ["Tip (18%) 4.00", "Suggested Tip 4.00", "Due 31.81", "Tax Due 2.06"]) {
      expect(parseReceipt(line).items).toHaveLength(0);
    }
  });
});
