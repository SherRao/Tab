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
