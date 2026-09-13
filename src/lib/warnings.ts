// Unassigned-item warnings, derived from expense_shares — the same table the
// ledger uses — so the warning can't disagree with the split (C2).

export interface WarningExpenseRow {
  expense: { description: string | null; splitMode: string };
  items: { item: { id: number; name: string } }[];
  shares: { lineItemId: number | null }[];
}

// An itemized line item is unassigned when no expense_shares row is scoped to
// it. Even receipts split at the total level, so their items never warn.
export function unassignedItemWarnings(rows: WarningExpenseRow[]): string[] {
  return rows.flatMap(({ expense, items, shares }) => {
    if (expense.splitMode !== "itemized") return [];
    const assignedItemIds = new Set(
      shares.filter((s) => s.lineItemId != null).map((s) => s.lineItemId),
    );
    return items
      .filter((i) => !assignedItemIds.has(i.item.id))
      .map((i) => `"${i.item.name}" in "${expense.description || "Untitled"}" has no assignees`);
  });
}
