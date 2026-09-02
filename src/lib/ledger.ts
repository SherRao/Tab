export interface LedgerParticipant {
  id: number;
  name: string;
}

export interface LedgerLineItem {
  name: string;
  amountCents: number;
  participantIds: number[];
}

export type SplitMode = "itemized" | "even" | "group";

export interface LedgerExpense {
  payerId: number;
  description?: string;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  splitMode: SplitMode;
  evenParticipantIds?: number[];
  groupIds?: number[];
  lineItems: LedgerLineItem[];
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

interface Consumption {
  paidCents: Map<number, number>;
  consumedCents: Map<number, number>;
}

function selectedParticipantIds(
  participantIds: number[],
  selectedIds: number[] | undefined,
): number[] {
  if (!selectedIds || selectedIds.length === 0) return participantIds;
  const selected = new Set(selectedIds);
  return participantIds.filter((id) => selected.has(id));
}

function computeConsumption(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
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

    // Resolve participant set: use groupIds if set,
    // otherwise fall back to evenParticipantIds, otherwise use all participants
    let participantIds: number[];
    if (expense.groupIds && expense.groupIds.length > 0) {
      participantIds = selectedParticipantIds(allIds, expense.groupIds);
    } else if (expense.evenParticipantIds && expense.evenParticipantIds.length > 0) {
      participantIds = selectedParticipantIds(allIds, expense.evenParticipantIds);
    } else {
      participantIds = allIds;
    }

    if (expense.splitMode === "even" || expense.splitMode === "group") {
      const ids = expense.splitMode === "group" ? participantIds : participantIds;
      const shares = equalSplit(expense.totalCents, ids.length);
      ids.forEach((id, i) => consumed.set(id, (consumed.get(id) ?? 0) + shares[i]));
      continue;
    }

    const subtotal = new Map<number, number>(participantIds.map((id) => [id, 0]));
    for (const item of expense.lineItems) {
      const assignees = item.participantIds.filter((id) => participantIds.includes(id));
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
        participantIds.map((id) => subtotal.get(id) ?? 0),
      );
      if (extra !== 0 && allocation.every((v) => v === 0) && participantIds.length > 0) {
        allocation = equalSplit(extra, participantIds.length);
      }
      participantIds.forEach((id, i) => consumed.set(id, (consumed.get(id) ?? 0) + allocation[i]));
    }

    participantIds.forEach((id) =>
      consumed.set(id, (consumed.get(id) ?? 0) + (subtotal.get(id) ?? 0)),
    );
  }

  return { paidCents: paid, consumedCents: consumed };
}

export function computeNetBalances(
  participants: LedgerParticipant[],
  expenses: LedgerExpense[],
): Map<number, number> {
  const { paidCents, consumedCents } = computeConsumption(participants, expenses);
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
): ParticipantBreakdown {
  const { paidCents, consumedCents } = computeConsumption(participants, expenses);
  const paid = paidCents.get(participantId) ?? 0;
  const consumed = consumedCents.get(participantId) ?? 0;

  const items: ParticipantBreakdown["items"] = [];
  let taxShareCents = 0;
  let tipShareCents = 0;
  let otherExtrasShareCents = 0;

  const allIds = participants.map((p) => p.id);

  for (const expense of expenses) {
    let participantIds: number[];
    if (expense.groupIds && expense.groupIds.length > 0) {
      participantIds = selectedParticipantIds(allIds, expense.groupIds);
    } else if (expense.evenParticipantIds && expense.evenParticipantIds.length > 0) {
      participantIds = selectedParticipantIds(allIds, expense.evenParticipantIds);
    } else {
      participantIds = allIds;
    }

    if (!participantIds.includes(participantId)) continue;

    if (expense.splitMode === "even" || expense.splitMode === "group") {
      const ids = expense.splitMode === "group" ? participantIds : participantIds;
      const shares = equalSplit(expense.totalCents, ids.length);
      const idx = ids.indexOf(participantId);
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
      continue;
    }

    const subtotal = new Map<number, number>(participantIds.map((id) => [id, 0]));
    for (const item of expense.lineItems) {
      const assignees = item.participantIds.filter((id) => participantIds.includes(id));
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
    const totalSubtotal = participantIds.reduce((sum, id) => sum + (subtotal.get(id) ?? 0), 0);

    for (const extra of extras) {
      if (extra.amount === 0) continue;
      let share = 0;
      if (totalSubtotal > 0) {
        share = Math.round((mySubtotal / totalSubtotal) * extra.amount);
      } else if (participantIds.length > 0) {
        share = Math.round(extra.amount / participantIds.length);
      }
      if (extra.type === "tax") taxShareCents += share;
      else if (extra.type === "tip") tipShareCents += share;
      else otherExtrasShareCents += share;
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
