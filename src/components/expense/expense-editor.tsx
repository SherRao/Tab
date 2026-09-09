"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGroupAction,
  deleteGroupAction,
  saveExpenseAction,
  updateGroupAction,
  updateExpenseAction,
} from "@/lib/actions";
import { toCents, toFixedMoney } from "@/lib/format";
import { ChipToggleGroup } from "@/components/ui/chip-toggle-group";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { LineItemRow, type EditorItem } from "./line-item-row";
import { SplitModeSelector, type SplitMode } from "./split-mode-selector";
import { TotalSharesPanel, type ShareConfig } from "./total-shares-panel";
import { GroupPillRow, type EditorGroup } from "./group-pill-row";
import { GroupCreateModal } from "./group-create-modal";

export interface EditorParticipant {
  id: number;
  name: string;
}

export type { EditorItem };

export type { EditorGroup };

export interface ExpenseEditorProps {
  token: string;
  participants: EditorParticipant[];
  groups?: EditorGroup[];
  eventName?: string;
  expenseId?: number;
  initial?: {
    description: string;
    payerId: number | undefined;
    items: EditorItem[];
    tax: string;
    tip: string;
    total: string;
    splitMode: "itemized" | "even";
    selectedParticipantIds: number[];
    /** Groups selected for an "As a total" split; each splits equally by live members. */
    selectedGroupIds?: number[];
    /** Stored whole-expense weights; omit to default everyone to an equal share. */
    shares?: ShareConfig[];
  };
}

function emptyItem(): EditorItem {
  return { name: "", amount: "", participantIds: [], quantity: "", participantQuantities: {} };
}

export default function ExpenseEditor({
  token,
  participants,
  groups: initialGroups = [],
  eventName = "",
  expenseId,
  initial,
}: ExpenseEditorProps) {
  const router = useRouter();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [payerId, setPayerId] = useState<number | undefined>(initial?.payerId);
  const [items, setItems] = useState<EditorItem[]>(
    initial?.items ?? [emptyItem()],
  );
  const [tax, setTax] = useState(initial?.tax ?? "");
  const [tip, setTip] = useState(initial?.tip ?? "");
  const [total, setTotal] = useState(initial?.total ?? "");
  const [splitMode, setSplitMode] = useState<SplitMode>(initial?.splitMode ?? "itemized");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>(
    initial?.selectedParticipantIds ?? participants.map((p) => p.id),
  );
  const [shares, setShares] = useState<ShareConfig[]>(() => {
    // Custom weights must survive a round-trip through the edit page; falling
    // back to "equal" here silently destroys a saved percent/amount split.
    if (initial?.shares?.length) return initial.shares;
    const ids = initial?.selectedParticipantIds ?? participants.map((p) => p.id);
    return ids.map((pid) => ({
      participantId: pid,
      weightType: "equal" as const,
      weightValue: 10000,
    }));
  });
  const [saving, setSaving] = useState(false);

  // Live copy of the event's groups so create/edit reflects immediately; the
  // server action's revalidate keeps the event page in sync.
  const [groups, setGroups] = useState<EditorGroup[]>(initialGroups);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(
    initial?.selectedGroupIds ?? [],
  );
  const [groupModal, setGroupModal] = useState<{ mode: "create" } | { mode: "edit"; id: number } | null>(
    null,
  );
  const [groupError, setGroupError] = useState<string | null>(null);

  // Members reachable through a selected group; explicit picks for these people
  // are redundant, so a group split forces an equal share for everyone in it.
  const groupMemberIds = useMemo(() => {
    const set = new Set<number>();
    for (const g of groups) {
      if (selectedGroupIds.includes(g.id)) g.memberIds.forEach((id) => set.add(id));
    }
    return set;
  }, [groups, selectedGroupIds]);
  const usingGroups = selectedGroupIds.length > 0;
  const resolvedHeadIds = useMemo(() => {
    const set = new Set<number>(groupMemberIds);
    selectedParticipantIds.forEach((id) => set.add(id));
    return [...set];
  }, [groupMemberIds, selectedParticipantIds]);

  const computed = useMemo(() => {
    let itemsSum = 0;
    for (const it of items) {
      const c = toCents(it.amount);
      if (!Number.isNaN(c)) itemsSum += c;
    }
    const t = toCents(tax) || 0;
    const p = toCents(tip) || 0;
    const enteredTotal = toCents(total);
    const expected = itemsSum + t + p;
    const discrepancy =
      Number.isNaN(enteredTotal) || enteredTotal === expected ? 0 : enteredTotal - expected;
    const unassigned = items.filter(
      (it) => it.participantIds.length === 0 && toCents(it.amount) > 0,
    ).length;
    return { itemsSum, expected, discrepancy, unassigned };
  }, [items, tax, tip, total]);

  function updateItem(idx: number, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function toggleAssignee(idx: number, pid: number) {
    const item = items[idx];
    const has = item.participantIds.includes(pid);
    updateItem(idx, {
      participantIds: has
        ? item.participantIds.filter((x) => x !== pid)
        : [...item.participantIds, pid],
    });
  }

  function assignAllToItem(idx: number) {
    updateItem(idx, { participantIds: participants.map((p) => p.id) });
  }

  type PayloadItem = {
    name: string;
    amountCents: number;
    participantIds: number[];
    quantity: number;
    participantQuantities: Record<number, number>;
  };

  /**
   * Build the `expense_shares` payload.
   *
   * Itemized weights are scoped to a line item by `itemIndex` (an index into
   * the same filtered item list sent as `items`); the action resolves it to the
   * real line item id once the rows exist. Every assigned item emits shares —
   * an item left out entirely would consume nothing.
   */
  function buildShares(payloadItems: PayloadItem[]) {
    if (splitMode === "even") {
      if (usingGroups) {
        // Group split: equal share for each selected group (live members) plus
        // any individuals picked outside those groups. No double-counting a
        // person who is both picked and in a selected group.
        const groupShares = selectedGroupIds.map((groupId) => ({
          groupId,
          lineItemId: null as number | null,
          weightType: "equal" as const,
          weightValue: 10000,
        }));
        const explicitShares = selectedParticipantIds
          .filter((id) => !groupMemberIds.has(id))
          .map((participantId) => ({
            participantId,
            lineItemId: null as number | null,
            weightType: "equal" as const,
            weightValue: 10000,
          }));
        return [...groupShares, ...explicitShares];
      }
      return shares.map((s) => ({
        participantId: s.participantId,
        lineItemId: null as number | null,
        weightType: s.weightType,
        weightValue: s.weightValue,
      }));
    }
    const result: {
      participantId: number;
      itemIndex: number;
      weightType: "equal" | "percent" | "amount";
      weightValue: number;
    }[] = [];
    payloadItems.forEach((item, itemIndex) => {
      if (item.participantIds.length === 0) return;
      const assignedQty = item.participantIds.reduce(
        (sum, pid) => sum + (item.participantQuantities[pid] || 0),
        0,
      );
      if (item.quantity > 0 && assignedQty > 0) {
        // Per-unit split: turn quantities into percent weights.
        for (const pid of item.participantIds) {
          result.push({
            participantId: pid,
            itemIndex,
            weightType: "percent",
            weightValue: Math.round(((item.participantQuantities[pid] || 0) / item.quantity) * 10000),
          });
        }
      } else {
        // No usable quantities: split the item equally between its assignees.
        for (const pid of item.participantIds) {
          result.push({ participantId: pid, itemIndex, weightType: "equal", weightValue: 10000 });
        }
      }
    });
    return result;
  }

  async function handleSave() {
    if (payerId === undefined) return;
    setSaving(true);
    try {
      const filteredItems = items
        .filter((it) => it.name.trim() || it.amount.trim())
        .map((it) => ({
          name: it.name.trim() || "Item",
          amountCents: toCents(it.amount) || 0,
          participantIds: it.participantIds,
          quantity: parseInt(it.quantity) || 0,
          participantQuantities: it.participantQuantities,
        }));

      const payloadShares = buildShares(filteredItems);

      const payload = {
        payerId,
        description,
        taxCents: toCents(tax) || 0,
        tipCents: toCents(tip) || 0,
        totalCents: toCents(total) || 0,
        splitMode,
        items: filteredItems,
        shares: payloadShares,
      };
      if (expenseId) {
        await updateExpenseAction(token, expenseId, payload);
      } else {
        await saveExpenseAction(token, payload);
      }
      router.push(`/e/${token}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleGroupSave(name: string, memberIds: number[]) {
    setGroupError(null);
    try {
      if (groupModal?.mode === "edit") {
        const id = groupModal.id;
        await updateGroupAction(token, id, name, memberIds);
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name, memberIds } : g)));
      } else {
        const id = await createGroupAction(token, name, memberIds);
        setGroups((prev) => [...prev, { id, name, memberIds }]);
        setSelectedGroupIds((prev) => [...prev, id]);
      }
      setGroupModal(null);
      router.refresh();
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : "Could not save the group");
    }
  }

  async function handleGroupDelete(id: number) {
    setGroupError(null);
    try {
      await deleteGroupAction(token, id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setSelectedGroupIds((prev) => prev.filter((gid) => gid !== id));
      setGroupModal(null);
      router.refresh();
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : "Could not delete the group");
    }
  }

  const editingGroup =
    groupModal?.mode === "edit" ? groups.find((g) => g.id === groupModal.id) : undefined;

  return (
    <div className="receipt-card receipt-edge">
      {groupModal && (
        <GroupCreateModal
          eventName={eventName}
          participants={participants}
          initialName={editingGroup?.name}
          initialMemberIds={editingGroup?.memberIds}
          error={groupError}
          onSave={handleGroupSave}
          onDelete={groupModal.mode === "edit" ? () => handleGroupDelete(groupModal.id) : undefined}
          onCancel={() => {
            setGroupError(null);
            setGroupModal(null);
          }}
        />
      )}
      <div className="receipt-lined space-y-7 p-6 pb-8 sm:p-8 sm:pb-9">
        <Field label="Description">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Lunch at Taco Place"
            className="input-ink mt-1.5"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Paid by">
            <select
              value={payerId ?? ""}
              onChange={(e) => setPayerId(Number(e.target.value))}
              className={`input-ink mt-1.5 ${payerId === undefined ? "text-stone-400" : ""}`}
            >
              <option value="" disabled>
                Select…
              </option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Total">
            <MoneyInput value={total} onChange={setTotal} className="font-semibold" />
          </Field>
        </div>

        <SplitModeSelector value={splitMode} onChange={setSplitMode} />

        {splitMode === "itemized" && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="label-mono text-stone-500">Line items</h2>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
                className="label-mono px-1 py-0.5 text-accent-strong transition hover:underline"
              >
                + Add item
              </button>
            </div>
            <ul className="mt-3 space-y-3">
              {items.map((item, idx) => (
                <LineItemRow
                  key={idx}
                  item={item}
                  participants={participants}
                  onPatch={(patch) => updateItem(idx, patch)}
                  onToggleAssignee={(pid) => toggleAssignee(idx, pid)}
                  onAssignAll={() => assignAllToItem(idx)}
                  onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  removable={items.length > 1}
                />
              ))}
            </ul>
            <p className="mt-2 font-mono text-[11px] tracking-wide text-stone-400 tabular-nums uppercase">
              Items so far: ${toFixedMoney(computed.itemsSum)}
            </p>
          </section>
        )}

        {splitMode === "even" && (
          <section>
            <h2 className="label-mono text-stone-500">Split between</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggleGroup
                size="md"
                participants={participants}
                selectedIds={selectedParticipantIds}
                lockedIds={[...groupMemberIds]}
                showSelectAll
                onToggle={(pid) =>
                  setSelectedParticipantIds((prev) => {
                    const next = prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid];
                    setShares(
                      next.map((id) => {
                        const existing = shares.find((s) => s.participantId === id);
                        return existing ?? { participantId: id, weightType: "equal" as const, weightValue: 10000 };
                      }),
                    );
                    return next;
                  })
                }
              />
            </div>

            <GroupPillRow
              groups={groups}
              selectedGroupIds={selectedGroupIds}
              onToggle={(gid) =>
                setSelectedGroupIds((prev) =>
                  prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid],
                )
              }
              onEdit={(gid) => {
                setGroupError(null);
                setGroupModal({ mode: "edit", id: gid });
              }}
              onNew={() => {
                setGroupError(null);
                setGroupModal({ mode: "create" });
              }}
            />

            {usingGroups ? (
              <p className="mt-4 border-l-4 border-l-accent/40 bg-accent/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-stone-500">
                Splitting equally between {resolvedHeadIds.length}{" "}
                {resolvedHeadIds.length === 1 ? "person" : "people"}. Groups always split evenly —
                clear the group pills to set custom shares.
              </p>
            ) : (
              <div className="mt-4">
                <TotalSharesPanel
                  participants={participants}
                  shares={shares}
                  totalCents={toCents(total) || 0}
                  onChange={setShares}
                />
              </div>
            )}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          <Field label="Tax">
            <MoneyInput value={tax} onChange={setTax} />
          </Field>
          <Field label="Tip">
            <MoneyInput value={tip} onChange={setTip} />
          </Field>
        </section>

        {splitMode === "itemized" && computed.discrepancy !== 0 && (
          <p className="border-l-4 border-l-amber-400 bg-amber-50 px-4 py-3 font-mono text-xs leading-relaxed text-amber-800">
            Items ({toFixedMoney(computed.itemsSum)}) + tax + tip = {toFixedMoney(computed.expected)},
            but the total you entered is {toFixedMoney(toCents(total))} (
            {computed.discrepancy > 0 ? "+" : ""}
            {toFixedMoney(computed.discrepancy)}). You can still save.
          </p>
        )}
        {splitMode === "itemized" && computed.unassigned > 0 && (
          <p className="font-mono text-xs text-amber-700">
            ! {computed.unassigned} line item{computed.unassigned > 1 ? "s" : ""} ha
            {computed.unassigned > 1 ? "ve" : "s"} no assignees yet.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex gap-3 border-t border-dashed border-foreground/25 bg-paper/95 px-6 py-4 backdrop-blur sm:px-8">
        <button
          type="button"
          disabled={saving || payerId === undefined}
          onClick={handleSave}
          className="btn-ink flex-1 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : expenseId ? "Save changes" : "Save receipt"}
        </button>
        <button type="button" onClick={() => router.push(`/e/${token}`)} className="btn-ghost">
          Cancel
        </button>
      </div>
      <p className="pb-6 text-center font-mono text-[11px] text-stone-400 sm:pb-7">
        {splitMode === "itemized" ? "By items" : "As a total"} · tax &amp; tip are shared proportionally
      </p>
    </div>
  );
}
