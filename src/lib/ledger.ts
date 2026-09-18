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
  id?: number;
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
  const equalIds = new Set<number>();

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
      } else if (share.weightType === "percent") {
        participantWeights.set(pid, (participantWeights.get(pid) ?? 0) + share.weightValue / 10000);
      } else {
        // Equal weight is presence, not additive: a participant reached via
        // several equal shares — overlapping groups, or a group plus an
        // explicit pick — still counts once. Spec: group members union.
        equalIds.add(pid);
      }
    }
  }
  for (const pid of equalIds) {
    if (!participantAmounts.has(pid)) {
      participantWeights.set(pid, (participantWeights.get(pid) ?? 0) + 1);
    }
  }

  // No shares resolved. When the input was empty (unassigned item), fall back
  // to an even split so the money is consumed (C1). When share rows existed but
  // resolved to nobody (invalid group, removed members), return nothing rather
  // than silently charging everyone (C31).
  if (participantWeights.size === 0 && participantAmounts.size === 0) {
    if (shares.length > 0) return [];
    for (const id of allParticipantIds) {
      participantWeights.set(id, 1);
    }
  }

  const result: { participantId: number; consumedCents: number }[] = [];

  if (participantAmounts.size > 0) {
    const amountPids = Array.from(participantAmounts.keys());
    const amounts = amountPids.map((id) => participantAmounts.get(id)!);
    const amountTotal = amounts.reduce((a, b) => a + b, 0);
    const remainder = totalCents - amountTotal;

    if (remainder < 0) {
      // Amounts exceed the total: scale them down proportionally so the split
      // still sums to the total. Weight participants consume nothing (C3).
      const scaled = allocateByWeights(totalCents, amounts);
      amountPids.forEach((id, i) => result.push({ participantId: id, consumedCents: scaled[i] }));
    } else {
      amountPids.forEach((id, i) => result.push({ participantId: id, consumedCents: amounts[i] }));
      if (remainder > 0 && participantWeights.size > 0) {
        // Distribute the remainder proportionally among weight participants.
        const pids = Array.from(participantWeights.keys());
        const weights = pids.map((id) => participantWeights.get(id)!);
        const alloc = allocateByWeights(remainder, weights);
        pids.forEach((id, i) => result.push({ participantId: id, consumedCents: alloc[i] }));
      } else if (remainder > 0) {
        // No weights to take the remainder — leave it on the last amount share.
        result[result.length - 1].consumedCents += remainder;
      }
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

  // Aggregate by participant: someone reachable via both an amount and a weight
  // share appears twice otherwise, and the breakdown's find() would see only the
  // first row (C4).
  const byId = new Map<number, number>();
  for (const r of result) {
    byId.set(r.participantId, (byId.get(r.participantId) ?? 0) + r.consumedCents);
  }
  return Array.from(byId, ([participantId, consumedCents]) => ({ participantId, consumedCents }));
}

export interface Consumption {
  paidCents: Map<number, number>;
  consumedCents: Map<number, number>;
  taxShareCents: Map<number, number>;
  tipShareCents: Map<number, number>;
  otherExtrasShareCents: Map<number, number>;
}

export function computeConsumption(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
  groupMemberLookup: (groupId: number) => number[] = () => [],
): Consumption {
  const paid = new Map<number, number>();
  const consumed = new Map<number, number>();
  const taxShareCents = new Map<number, number>();
  const tipShareCents = new Map<number, number>();
  const otherExtrasShareCents = new Map<number, number>();
  for (const p of participants) {
    paid.set(p.id, 0);
    consumed.set(p.id, 0);
    taxShareCents.set(p.id, 0);
    tipShareCents.set(p.id, 0);
    otherExtrasShareCents.set(p.id, 0);
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
          const resolved = resolveShares(
            totalShares,
            expense.totalCents,
            allIds,
            groupMemberLookup,
          );
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

        // Group shares by line item.
        const sharesByLine = new Map<number, LedgerShare[]>();
        for (const s of lineShares) {
          const lid = s.lineItemId!;
          const arr = sharesByLine.get(lid) ?? [];
          arr.push(s);
          sharesByLine.set(lid, arr);
        }

        // Split every line item over its own shares. An item with no shares of
        // its own is unassigned; resolveShares then falls back to an even split
        // across all participants, so the item's money is still consumed and
        // the receipt sums to its total (C1) rather than silently vanishing.
        const subtotal = new Map<number, number>(allIds.map((id) => [id, 0]));
        for (const lineItem of expense.lineItems) {
          const itemShares = lineItem.id != null ? (sharesByLine.get(lineItem.id) ?? []) : [];
          const resolved = resolveShares(
            itemShares,
            lineItem.amountCents,
            allIds,
            groupMemberLookup,
          );
          for (const r of resolved) {
            subtotal.set(r.participantId, (subtotal.get(r.participantId) ?? 0) + r.consumedCents);
          }
        }

        // Add subtotal to consumed
        for (const [id, cents] of subtotal) {
          consumed.set(id, (consumed.get(id) ?? 0) + cents);
        }

        // Allocate tax/tip proportionally to pre-tax subtotals, tracking each
        // participant's extras share so the breakdown can read it back (C5).
        const itemsTotal = expense.lineItems.reduce((a, b) => a + b.amountCents, 0);
        const extrasAmounts = [
          expense.taxCents,
          expense.tipCents,
          expense.totalCents - itemsTotal - expense.taxCents - expense.tipCents,
        ];
        const extrasMaps = [taxShareCents, tipShareCents, otherExtrasShareCents];
        for (let ei = 0; ei < extrasAmounts.length; ei++) {
          let allocation = allocateByWeights(
            extrasAmounts[ei],
            allIds.map((id) => subtotal.get(id) ?? 0),
          );
          if (extrasAmounts[ei] !== 0 && allocation.every((v) => v === 0) && allIds.length > 0) {
            allocation = equalSplit(extrasAmounts[ei], allIds.length);
          }
          const map = extrasMaps[ei];
          allIds.forEach((id, i) => {
            consumed.set(id, (consumed.get(id) ?? 0) + allocation[i]);
            map.set(id, (map.get(id) ?? 0) + allocation[i]);
          });
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
        const extrasAmounts = [
          expense.taxCents,
          expense.tipCents,
          expense.totalCents - itemsTotal - expense.taxCents - expense.tipCents,
        ];
        const extrasMaps = [taxShareCents, tipShareCents, otherExtrasShareCents];
        for (let ei = 0; ei < extrasAmounts.length; ei++) {
          let allocation = allocateByWeights(
            extrasAmounts[ei],
            allIds.map((id) => subtotal.get(id) ?? 0),
          );
          if (extrasAmounts[ei] !== 0 && allocation.every((v) => v === 0) && allIds.length > 0) {
            allocation = equalSplit(extrasAmounts[ei], allIds.length);
          }
          const map = extrasMaps[ei];
          allIds.forEach((id, i) => {
            consumed.set(id, (consumed.get(id) ?? 0) + allocation[i]);
            map.set(id, (map.get(id) ?? 0) + allocation[i]);
          });
        }
        allIds.forEach((id) => consumed.set(id, (consumed.get(id) ?? 0) + (subtotal.get(id) ?? 0)));
      }
    }
  }

  return {
    paidCents: paid,
    consumedCents: consumed,
    taxShareCents,
    tipShareCents,
    otherExtrasShareCents,
  };
}

export function computeNetBalances(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
  groupMemberLookup: (groupId: number) => number[] = () => [],
): Map<number, number> {
  const { paidCents, consumedCents } = computeConsumption(
    participants,
    expenses,
    groupMemberLookup,
  );
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
    /** How this receipt was split, for display: "By items" / "As a total · Equal|Custom". */
    splitLabel: string;
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
  precomputed?: Consumption,
): ParticipantBreakdown {
  const consumption = precomputed ?? computeConsumption(participants, expenses, groupMemberLookup);
  const paid = consumption.paidCents.get(participantId) ?? 0;
  const consumed = consumption.consumedCents.get(participantId) ?? 0;

  const items: ParticipantBreakdown["items"] = [];

  const allIds = participants.map((p) => p.id);

  for (const expense of expenses) {
    // Compute this participant's consumption for this expense
    if (expense.shares && expense.shares.length > 0) {
      if (expense.splitMode === "even") {
        const totalShares = expense.shares.filter(
          (s) => s.lineItemId == null || s.lineItemId === undefined,
        );
        if (totalShares.length > 0) {
          const resolved = resolveShares(
            totalShares,
            expense.totalCents,
            allIds,
            groupMemberLookup,
          );
          const myShare = resolved.find((r) => r.participantId === participantId);
          const custom = totalShares.some((s) => s.weightType !== "equal");
          if (myShare && myShare.consumedCents > 0) {
            items.push({
              expenseId: expense.id ?? 0,
              expenseDescription: expense.description,
              splitLabel: `As a total · ${custom ? "Custom" : "Equal"}`,
              itemName: expense.description || "Split",
              itemAmountCents: expense.totalCents,
              shareCents: myShare.consumedCents,
            });
          }
        } else {
          // Fallback: equal split
          const shares = equalSplit(expense.totalCents, allIds.length);
          const idx = allIds.indexOf(participantId);
          if (idx >= 0) {
            items.push({
              expenseId: expense.id ?? 0,
              expenseDescription: expense.description,
              splitLabel: "As a total · Equal",
              itemName: expense.description || "Split",
              itemAmountCents: expense.totalCents,
              shareCents: shares[idx],
            });
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

        for (const lineItem of expense.lineItems) {
          // Mirrors computeConsumption: unassigned items split across everyone (C1).
          const itemShares = lineItem.id != null ? (sharesByLine.get(lineItem.id) ?? []) : [];
          const resolved = resolveShares(
            itemShares,
            lineItem.amountCents,
            allIds,
            groupMemberLookup,
          );
          const myShare = resolved.find((r) => r.participantId === participantId);
          if (myShare && myShare.consumedCents > 0) {
            items.push({
              expenseId: expense.id ?? 0,
              expenseDescription: expense.description,
              splitLabel: "By items",
              itemName: lineItem.name,
              itemAmountCents: lineItem.amountCents,
              shareCents: myShare.consumedCents,
            });
          }
        }

        // Extras are allocated in computeConsumption; the breakdown reads the
        // per-participant totals from that pass so the parts always reconcile
        // with totalConsumedCents (C5).
      }
    } else {
      // Fallback: no shares (backward compatibility)
      if (expense.splitMode === "even") {
        const shares = equalSplit(expense.totalCents, allIds.length);
        const idx = allIds.indexOf(participantId);
        if (idx >= 0) {
          items.push({
            expenseId: expense.id ?? 0,
            expenseDescription: expense.description,
            splitLabel: "As a total · Equal",
            itemName: expense.description || "Split",
            itemAmountCents: expense.totalCents,
            shareCents: shares[idx],
          });
        }
      } else {
        for (const item of expense.lineItems) {
          const assignees = item.participantIds.filter((id) => allIds.includes(id));
          if (assignees.length === 0) continue;
          const shares = equalSplit(item.amountCents, assignees.length);
          const idx = assignees.indexOf(participantId);
          if (idx >= 0) {
            items.push({
              expenseId: expense.id ?? 0,
              expenseDescription: expense.description,
              splitLabel: "By items",
              itemName: item.name,
              itemAmountCents: item.amountCents,
              shareCents: shares[idx],
            });
          }
        }
      }
    }
  }

  const totalConsumedCents = consumed;
  const netCents = paid - totalConsumedCents;

  return {
    participantId,
    items,
    taxShareCents: consumption.taxShareCents.get(participantId) ?? 0,
    tipShareCents: consumption.tipShareCents.get(participantId) ?? 0,
    otherExtrasShareCents: consumption.otherExtrasShareCents.get(participantId) ?? 0,
    totalConsumedCents,
    totalPaidCents: paid,
    netCents,
  };
}
