export interface LedgerParticipant {
  id: number;
  name: string;
}

export interface LedgerLineItem {
  id?: number;
  name: string;
  amountCents: number;
  participantIds: number[];
}

export type SplitMode = "itemized" | "even";

export interface LedgerShare {
  participantId?: number;
  groupId?: number;
  lineItemId?: number | null;
  weightType: "equal" | "percent" | "amount";
  weightValue: number;
}

export interface LedgerExpense {
  payerId: number;
  description?: string;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  splitMode: SplitMode;
  lineItems: LedgerLineItem[];
  shares?: LedgerShare[];
}

export interface Transfer {
  fromId: number;
  toId: number;
  amountCents: number;
}

function allocatePositive(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w * total) / sum);
  const floors = exact.map((e) => Math.floor(e));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] += 1;
    remainder -= 1;
  }
  return out;
}

export function allocateByWeights(totalCents: number, weights: number[]): number[] {
  if (totalCents < 0) {
    return allocatePositive(-totalCents, weights).map((v) => -v);
  }
  return allocatePositive(totalCents, weights);
}

export function equalSplit(totalCents: number, count: number): number[] {
  return allocateByWeights(
    totalCents,
    Array.from({ length: count }, () => 1),
  );
}

/**
 * Resolve a set of shares into per-participant cent amounts for a given total.
 *
 * Handles:
 * - explicit participantId rows
 * - groupId rows resolved via groupMemberLookup (live link)
 * - weight types: equal, percent, amount
 * - mixed weight types: exact amounts first, remainder distributed proportionally
 */
function resolveShares(
  shares: LedgerShare[],
  totalCents: number,
  allParticipantIds: number[],
  groupMemberLookup: (groupId: number) => number[],
): { participantId: number; consumedCents: number }[] {
  // Aggregate weights per participant
  const participantWeights = new Map<number, number>();
  const participantAmounts = new Map<number, number>();

  for (const share of shares) {
    let pids: number[] = [];
    if (share.participantId != null) {
      pids = [share.participantId];
    } else if (share.groupId != null) {
      pids = groupMemberLookup(share.groupId);
    } else {
      continue;
    }

    for (const pid of pids) {
      if (share.weightType === "amount") {
        participantAmounts.set(pid, (participantAmounts.get(pid) ?? 0) + share.weightValue);
      } else {
        const w = share.weightType === "percent" ? share.weightValue / 10000 : 1;
        participantWeights.set(pid, (participantWeights.get(pid) ?? 0) + w);
      }
    }
  }

  // If no participants resolved, fall back to all
  if (participantWeights.size === 0 && participantAmounts.size === 0) {
    for (const id of allParticipantIds) {
      participantWeights.set(id, 1);
    }
  }

  const result: { participantId: number; consumedCents: number }[] = [];

  if (participantAmounts.size > 0) {
    // Assign exact amounts
    let amountTotal = 0;
    for (const [pid, cents] of participantAmounts) {
      result.push({ participantId: pid, consumedCents: cents });
      amountTotal += cents;
    }
    // Distribute remainder proportionally among weight-based participants
    const remainder = totalCents - amountTotal;
    if (remainder > 0 && participantWeights.size > 0) {
      const pids = Array.from(participantWeights.keys());
      const weights = pids.map((id) => participantWeights.get(id)!);
      const alloc = allocateByWeights(remainder, weights);
      for (let i = 0; i < pids.length; i++) {
        result.push({ participantId: pids[i], consumedCents: alloc[i] });
      }
    } else if (remainder !== 0 && participantWeights.size === 0) {
      // All amount shares - absorb rounding into last
      result[result.length - 1].consumedCents += remainder;
    }
  } else {
    // Pure proportional
    const pids = Array.from(participantWeights.keys());
    const weights = pids.map((id) => participantWeights.get(id)!);
    const alloc = allocateByWeights(totalCents, weights);
    for (let i = 0; i < pids.length; i++) {
      result.push({ participantId: pids[i], consumedCents: alloc[i] });
    }
  }

  return result;
}

interface Consumption {
  paidCents: Map<number, number>;
  consumedCents: Map<number, number>;
}

function computeConsumption(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
  groupMemberLookup: (groupId: number) => number[] = () => [],
): Consumption {
  const paid = new Map<number, number>();
  const consumed = new Map<number, number>();
  for (const p of participants) {
    paid.set(p.id, 0);
    consumed.set(p.id, 0);
  }
  const allIds = participants.map((p) => p.id);

  for (const expense of expenses) {
    paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.totalCents);

    if (expense.shares && expense.shares.length > 0) {
      if (expense.splitMode === "even") {
        // Total-level shares (lineItemId = null)
        const totalShares = expense.shares.filter(
          (s) => s.lineItemId == null || s.lineItemId === undefined,
        );
        if (totalShares.length > 0) {
          const resolved = resolveShares(totalShares, expense.totalCents, allIds, groupMemberLookup);
          for (const r of resolved) {
            consumed.set(r.participantId, (consumed.get(r.participantId) ?? 0) + r.consumedCents);
          }
        } else {
          // Fallback: equal split
          const shares = equalSplit(expense.totalCents, allIds.length);
          allIds.forEach((id, i) => consumed.set(id, (consumed.get(id) ?? 0) + shares[i]));
        }
      } else {
        // Itemized: line-item level shares
        const lineShares = expense.shares.filter(
          (s) => s.lineItemId != null && s.lineItemId !== undefined,
        );

        // Group by lineItemId
        const sharesByLine = new Map<number, LedgerShare[]>();
        for (const s of lineShares) {
          const lid = s.lineItemId!;
          const arr = sharesByLine.get(lid) ?? [];
          arr.push(s);
          sharesByLine.set(lid, arr);
        }

        // Compute per-line-item subtotals
        const subtotal = new Map<number, number>(allIds.map((id) => [id, 0]));
        const lineItemAmounts = new Map<number, number>();

        for (const [lineItemId, shares] of sharesByLine) {
          // Find matching line item by ID
          const lineItem = expense.lineItems.find((li) => li.id === lineItemId);
          const amount = lineItem?.amountCents ?? 0;
          lineItemAmounts.set(lineItemId, amount);

          const resolved = resolveShares(shares, amount, allIds, groupMemberLookup);
          for (const r of resolved) {
            subtotal.set(r.participantId, (subtotal.get(r.participantId) ?? 0) + r.consumedCents);
          }
        }

        // Add subtotal to consumed
        for (const [id, cents] of subtotal) {
          consumed.set(id, (consumed.get(id) ?? 0) + cents);
        }

        // Allocate tax/tip proportionally to pre-tax subtotals
        const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
        const extras = [
          expense.taxCents,
          expense.tipCents,
          expense.totalCents - itemsTotal - expense.taxCents - expense.tipCents,
        ];
        for (const extra of extras) {
          let allocation = allocateByWeights(
            extra,
            allIds.map((id) => subtotal.get(id) ?? 0),
          );
          if (extra !== 0 && allocation.every((v) => v === 0) && allIds.length > 0) {
            allocation = equalSplit(extra, allIds.length);
          }
          allIds.forEach((id, i) =>
            consumed.set(id, (consumed.get(id) ?? 0) + allocation[i]),
          );
        }
      }
    } else {
      // Fallback: no shares (backward compatibility for edge cases)
      if (expense.splitMode === "even") {
        const shares = equalSplit(expense.totalCents, allIds.length);
        allIds.forEach((id, i) => consumed.set(id, (consumed.get(id) ?? 0) + shares[i]));
      } else {
        const subtotal = new Map<number, number>(allIds.map((id) => [id, 0]));
        for (const item of expense.lineItems) {
          const assignees = item.participantIds.filter((id) => allIds.includes(id));
          if (assignees.length === 0) continue;
          const shares = equalSplit(item.amountCents, assignees.length);
          assignees.forEach((id, i) => subtotal.set(id, (subtotal.get(id) ?? 0) + shares[i]));
        }
        const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
        const extras = [
          expense.taxCents,
          expense.tipCents,
          expense.totalCents - itemsTotal - expense.taxCents - expense.tipCents,
        ];
        for (const extra of extras) {
          let allocation = allocateByWeights(
            extra,
            allIds.map((id) => subtotal.get(id) ?? 0),
          );
          if (extra !== 0 && allocation.every((v) => v === 0) && allIds.length > 0) {
            allocation = equalSplit(extra, allIds.length);
          }
          allIds.forEach((id, i) =>
            consumed.set(id, (consumed.get(id) ?? 0) + allocation[i]),
          );
        }
        allIds.forEach((id) =>
          consumed.set(id, (consumed.get(id) ?? 0) + (subtotal.get(id) ?? 0)),
        );
      }
    }
  }

  return { paidCents: paid, consumedCents: consumed };
}

export function computeNetBalances(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
  groupMemberLookup: (groupId: number) => number[] = () => [],
): Map<number, number> {
  const { paidCents, consumedCents } = computeConsumption(participants, expenses, groupMemberLookup);
  const nets = new Map<number, number>();
  for (const p of participants) {
    nets.set(p.id, (paidCents.get(p.id) ?? 0) - (consumedCents.get(p.id) ?? 0));
  }
  return nets;
}

export function simplifyDebts(nets: Map<number, number>): Transfer[] {
  const balances = new Map(nets);
  const transfers: Transfer[] = [];
  for (;;) {
    let maxCreditor: number | undefined;
    let maxDebtor: number | undefined;
    for (const [id, bal] of balances) {
      if (bal > 0 && (maxCreditor === undefined || bal > (balances.get(maxCreditor) ?? 0))) {
        maxCreditor = id;
      }
      if (bal < 0 && (maxDebtor === undefined || -bal > -(balances.get(maxDebtor) ?? 0))) {
        maxDebtor = id;
      }
    }
    if (maxCreditor === undefined || maxDebtor === undefined) break;
    const credit = balances.get(maxCreditor)!;
    const debit = -balances.get(maxDebtor)!;
    const amount = Math.min(credit, debit);
    transfers.push({ fromId: maxDebtor, toId: maxCreditor, amountCents: amount });
    balances.set(maxCreditor, credit - amount);
    balances.set(maxDebtor, -(debit - amount));
  }
  return transfers;
}

export interface ParticipantBreakdown {
  participantId: number;
  items: {
    expenseId: number;
    expenseDescription: string | undefined;
    itemName: string;
    itemAmountCents: number;
    shareCents: number;
  }[];
  taxShareCents: number;
  tipShareCents: number;
  otherExtrasShareCents: number;
  totalConsumedCents: number;
  totalPaidCents: number;
  netCents: number;
}

export function computeParticipantBreakdown(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
  participantId: number,
  groupMemberLookup: (groupId: number) => number[] = () => [],
): ParticipantBreakdown {
  const { paidCents, consumedCents } = computeConsumption(participants, expenses, groupMemberLookup);
  const paid = paidCents.get(participantId) ?? 0;
  const consumed = consumedCents.get(participantId) ?? 0;

  const items: ParticipantBreakdown["items"] = [];
  let taxShareCents = 0;
  let tipShareCents = 0;
  let otherExtrasShareCents = 0;

  const allIds = participants.map((p) => p.id);

  for (const expense of expenses) {
    // Compute this participant's consumption for this expense
    if (expense.shares && expense.shares.length > 0) {
      if (expense.splitMode === "even") {
        const totalShares = expense.shares.filter(
          (s) => s.lineItemId == null || s.lineItemId === undefined,
        );
        if (totalShares.length > 0) {
          const resolved = resolveShares(totalShares, expense.totalCents, allIds, groupMemberLookup);
          const myShare = resolved.find((r) => r.participantId === participantId);
          if (myShare && myShare.consumedCents > 0) {
            items.push({
              expenseId: 0,
              expenseDescription: expense.description,
              itemName: expense.description || "Split",
              itemAmountCents: expense.totalCents,
              shareCents: myShare.consumedCents,
            });
            const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
            const taxTipOther = expense.totalCents - itemsTotal;
            if (taxTipOther > 0) {
              const taxRatio = expense.taxCents / taxTipOther;
              const tipRatio = expense.tipCents / taxTipOther;
              const otherRatio = 1 - taxRatio - tipRatio;
              taxShareCents += Math.round(myShare.consumedCents * taxRatio);
              tipShareCents += Math.round(myShare.consumedCents * tipRatio);
              otherExtrasShareCents += Math.round(myShare.consumedCents * otherRatio);
            }
          }
        } else {
          // Fallback: equal split
          const shares = equalSplit(expense.totalCents, allIds.length);
          const idx = allIds.indexOf(participantId);
          if (idx >= 0) {
            const share = shares[idx];
            items.push({
              expenseId: 0,
              expenseDescription: expense.description,
              itemName: expense.description || "Split",
              itemAmountCents: expense.totalCents,
              shareCents: share,
            });
            const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
            const taxTipOther = expense.totalCents - itemsTotal;
            if (taxTipOther > 0) {
              const taxRatio = expense.taxCents / taxTipOther;
              const tipRatio = expense.tipCents / taxTipOther;
              const otherRatio = 1 - taxRatio - tipRatio;
              taxShareCents += Math.round(share * taxRatio);
              tipShareCents += Math.round(share * tipRatio);
              otherExtrasShareCents += Math.round(share * otherRatio);
            }
          }
        }
      } else {
        // Itemized: line-item level shares
        const lineShares = expense.shares.filter(
          (s) => s.lineItemId != null && s.lineItemId !== undefined,
        );
        const sharesByLine = new Map<number, LedgerShare[]>();
        for (const s of lineShares) {
          const lid = s.lineItemId!;
          const arr = sharesByLine.get(lid) ?? [];
          arr.push(s);
          sharesByLine.set(lid, arr);
        }

        const subtotal = new Map<number, number>(allIds.map((id) => [id, 0]));
        for (const [lineItemId, shares] of sharesByLine) {
          const lineItem = expense.lineItems.find((li) => li.id === lineItemId);
          const amount = lineItem?.amountCents ?? 0;
          const resolved = resolveShares(shares, amount, allIds, groupMemberLookup);
          const myShare = resolved.find((r) => r.participantId === participantId);
          if (myShare && myShare.consumedCents > 0) {
            subtotal.set(participantId, (subtotal.get(participantId) ?? 0) + myShare.consumedCents);
            items.push({
              expenseId: 0,
              expenseDescription: expense.description,
              itemName: lineItem?.name ?? "Item",
              itemAmountCents: amount,
              shareCents: myShare.consumedCents,
            });
          }
        }

        const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
        const extras = [
          { amount: expense.taxCents, type: "tax" as const },
          { amount: expense.tipCents, type: "tip" as const },
          {
            amount: expense.totalCents - itemsTotal - expense.taxCents - expense.tipCents,
            type: "other" as const,
          },
        ];
        const mySubtotal = subtotal.get(participantId) ?? 0;
        const totalSubtotal = allIds.reduce((sum, id) => sum + (subtotal.get(id) ?? 0), 0);
        for (const extra of extras) {
          if (extra.amount === 0) continue;
          let share = 0;
          if (totalSubtotal > 0) {
            share = Math.round((mySubtotal / totalSubtotal) * extra.amount);
          } else if (allIds.length > 0) {
            share = Math.round(extra.amount / allIds.length);
          }
          if (extra.type === "tax") taxShareCents += share;
          else if (extra.type === "tip") tipShareCents += share;
          else otherExtrasShareCents += share;
        }
      }
    } else {
      // Fallback: no shares (backward compatibility)
      if (expense.splitMode === "even") {
        const shares = equalSplit(expense.totalCents, allIds.length);
        const idx = allIds.indexOf(participantId);
        if (idx >= 0) {
          const share = shares[idx];
          items.push({
            expenseId: 0,
            expenseDescription: expense.description,
            itemName: expense.description || "Split",
            itemAmountCents: expense.totalCents,
            shareCents: share,
          });
          const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
          const taxTipOther = expense.totalCents - itemsTotal;
          if (taxTipOther > 0) {
            const taxRatio = expense.taxCents / taxTipOther;
            const tipRatio = expense.tipCents / taxTipOther;
            const otherRatio = 1 - taxRatio - tipRatio;
            taxShareCents += Math.round(share * taxRatio);
            tipShareCents += Math.round(share * tipRatio);
            otherExtrasShareCents += Math.round(share * otherRatio);
          }
        }
      } else {
        const subtotal = new Map<number, number>(allIds.map((id) => [id, 0]));
        for (const item of expense.lineItems) {
          const assignees = item.participantIds.filter((id) => allIds.includes(id));
          if (assignees.length === 0) continue;
          const shares = equalSplit(item.amountCents, assignees.length);
          const idx = assignees.indexOf(participantId);
          if (idx >= 0) {
            const share = shares[idx];
            subtotal.set(participantId, (subtotal.get(participantId) ?? 0) + share);
            items.push({
              expenseId: 0,
              expenseDescription: expense.description,
              itemName: item.name,
              itemAmountCents: item.amountCents,
              shareCents: share,
            });
          }
        }
        const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
        const extras = [
          { amount: expense.taxCents, type: "tax" as const },
          { amount: expense.tipCents, type: "tip" as const },
          {
            amount: expense.totalCents - itemsTotal - expense.taxCents - expense.tipCents,
            type: "other" as const,
          },
        ];
        const mySubtotal = subtotal.get(participantId) ?? 0;
        const totalSubtotal = allIds.reduce((sum, id) => sum + (subtotal.get(id) ?? 0), 0);
        for (const extra of extras) {
          if (extra.amount === 0) continue;
          let share = 0;
          if (totalSubtotal > 0) {
            share = Math.round((mySubtotal / totalSubtotal) * extra.amount);
          } else if (allIds.length > 0) {
            share = Math.round(extra.amount / allIds.length);
          }
          if (extra.type === "tax") taxShareCents += share;
          else if (extra.type === "tip") tipShareCents += share;
          else otherExtrasShareCents += share;
        }
      }
    }
  }

  const totalConsumedCents = consumed;
  const netCents = paid - totalConsumedCents;

  return {
    participantId,
    items,
    taxShareCents,
    tipShareCents,
    otherExtrasShareCents,
    totalConsumedCents,
    totalPaidCents: paid,
    netCents,
  };
}
