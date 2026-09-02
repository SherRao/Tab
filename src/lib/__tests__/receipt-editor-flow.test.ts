import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReceipt } from "../receipt-parse";
import type { EditorItem } from "@/components/expense/expense-editor";

const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "../__fixtures__/receipts", name), "utf8");

function toEditorInitial(draft: ReturnType<typeof parseReceipt>) {
  return {
    description: "",
    payerId: undefined,
    items: draft.items.map((i): EditorItem => ({
      name: i.name,
      amount: (i.amountCents / 100).toFixed(2),
      participantIds: [],
      quantity: "",
      participantQuantities: {},
    })),
    tax: draft.taxCents ? (draft.taxCents / 100).toFixed(2) : "",
    tip: draft.tipCents ? (draft.tipCents / 100).toFixed(2) : "",
    total: draft.totalCents ? (draft.totalCents / 100).toFixed(2) : "",
    splitMode: "itemized" as const,
    selectedParticipantIds: [] as number[],
  };
}

describe("scanned draft feeds the expense editor", () => {
  it("clean receipt produces a complete editor draft", () => {
    const draft = parseReceipt(fixture("clean.txt"));
    const initial = toEditorInitial(draft);
    expect(initial.items).toEqual([
      { name: "2x Latte", amount: "9.00", participantIds: [], quantity: "", participantQuantities: {} },
      { name: "1x Croissant", amount: "4.25", participantIds: [], quantity: "", participantQuantities: {} },
      { name: "Avocado Toast", amount: "12.50", participantIds: [], quantity: "", participantQuantities: {} },
    ]);
    expect(initial.tax).toBe("2.06");
    expect(initial.tip).toBe("4.00");
    expect(initial.total).toBe("31.81");
    expect(initial.payerId).toBeUndefined();
    expect(initial.splitMode).toBe("itemized");
  });

  it("reconciliation math holds: items + tax + tip equals total", () => {
    for (const name of ["clean.txt", "no-tip.txt", "comma-decimal.txt", "total-named-items.txt"]) {
      const draft = parseReceipt(fixture(name));
      const sum =
        draft.items.reduce((a, b) => a + b.amountCents, 0) + draft.taxCents + draft.tipCents;
      expect(Math.abs(sum - draft.totalCents)).toBeLessThanOrEqual(2);
    }
  });

  it("unusable draft still yields an editable partial draft", () => {
    const draft = parseReceipt(fixture("unreadable.txt"));
    const initial = toEditorInitial(draft);
    expect(initial.items).toHaveLength(0);
    expect(initial.total).toBe("");
    expect(draft.usable).toBe(false);
  });
});
