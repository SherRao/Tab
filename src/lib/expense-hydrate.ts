import type { ExpenseWithItems } from "@/lib/queries";

export interface EditorShare {
  participantId: number;
  weightType: "equal" | "percent" | "amount";
  weightValue: number;
}

/**
 * Rebuild the editor's whole-expense share state from stored `expense_shares`.
 *
 * Only total-level rows (no `lineItemId`) that name a participant are editable
 * today. Group rows are skipped until the editor grows group pills, and
 * line-item rows are skipped until per-item weights are editable.
 */
export function hydrateTotalShares(shares: ExpenseWithItems["shares"]): EditorShare[] {
  return shares
    .filter((s) => s.lineItemId == null && s.participantId != null)
    .map((s) => ({
      participantId: s.participantId as number,
      weightType: s.weightType,
      weightValue: s.weightValue,
    }));
}

/** Group ids selected on a whole-expense (`even`) split, for editor hydration. */
export function hydrateSelectedGroupIds(shares: ExpenseWithItems["shares"]): number[] {
  return [
    ...new Set(
      shares
        .filter((s) => s.lineItemId == null && s.groupId != null)
        .map((s) => s.groupId as number),
    ),
  ];
}
