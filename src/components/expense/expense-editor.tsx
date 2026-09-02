"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveExpenseAction, updateExpenseAction } from "@/lib/actions";
import { toCents, toFixedMoney } from "@/lib/format";
import { ChipToggleGroup } from "@/components/ui/chip-toggle-group";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { LineItemRow } from "./line-item-row";
import { MODES, SplitModeSelector, type SplitMode } from "./split-mode-selector";

export interface EditorParticipant {
  id: number;
  name: string;
}

export interface EditorItem {
  name: string;
  amount: string;
  participantIds: number[];
}

export interface ExpenseEditorProps {
  token: string;
  participants: EditorParticipant[];
  expenseId?: number;
  initial?: {
    description: string;
    payerId: number | undefined;
    items: EditorItem[];
    tax: string;
    tip: string;
    total: string;
    splitMode: "itemized" | "even" | "group";
    evenParticipantIds: number[];
    groupIds: number[] | undefined;
  };
}

export default function ExpenseEditor({
  token,
  participants,
  expenseId,
  initial,
}: ExpenseEditorProps) {
  const router = useRouter();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [payerId, setPayerId] = useState<number | undefined>(initial?.payerId);
  const [items, setItems] = useState<EditorItem[]>(
    initial?.items ?? [{ name: "", amount: "", participantIds: [] }],
  );
  const [tax, setTax] = useState(initial?.tax ?? "");
  const [tip, setTip] = useState(initial?.tip ?? "");
  const [total, setTotal] = useState(initial?.total ?? "");
  const [splitMode, setSplitMode] = useState<SplitMode>(initial?.splitMode ?? "itemized");
  const [evenIds, setEvenIds] = useState<number[]>(initial?.evenParticipantIds ?? []);
  const [groupIds, setGroupIds] = useState<number[]>(initial?.groupIds ?? []);
  const [saving, setSaving] = useState(false);

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

  async function handleSave() {
    if (payerId === undefined) return;
    setSaving(true);
    try {
      const payload = {
        payerId,
        description,
        taxCents: toCents(tax) || 0,
        tipCents: toCents(tip) || 0,
        totalCents: toCents(total) || 0,
        splitMode,
        evenParticipantIds: evenIds,
        groupIds: groupIds.length > 0 ? groupIds : undefined,
        items: items
          .filter((it) => it.name.trim() || it.amount.trim())
          .map((it) => ({
            name: it.name.trim() || "Item",
            amountCents: toCents(it.amount) || 0,
            participantIds: it.participantIds,
          })),
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

  const activeMode = MODES.find((m) => m.value === splitMode)!;

  return (
    <div className="receipt-card receipt-edge">
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
                onClick={() =>
                  setItems((prev) => [...prev, { name: "", amount: "", participantIds: [] }])
                }
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
                selectedIds={evenIds}
                onToggle={(pid) =>
                  setEvenIds((prev) =>
                    prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
                  )
                }
              />
            </div>
          </section>
        )}

        {splitMode === "group" && (
          <p className="flex items-center gap-2 border border-dashed border-accent/50 bg-accent/10 px-4 py-3 font-mono text-xs text-accent-strong">
            Everyone in the event splits the whole total equally.
          </p>
        )}

        <div className="mt-4 space-y-2">
          <label className="label-mono block text-stone-500">Assign to group(s)</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {participants.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={groupIds.includes(p.id)}
                  onChange={(e) =>
                    setGroupIds(
                      e.target.checked ? [...groupIds, p.id] : groupIds.filter((id) => id !== p.id),
                    )
                  }
                  className="rounded border-accent-strong"
                />
                {p.name}
              </label>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-stone-400">
            {groupIds.length} participant{groupIds.length !== 1 ? "s" : ""} selected
          </p>
        </div>

        {(splitMode === "itemized" || splitMode === "group") && (
          <section className="grid grid-cols-2 gap-3">
            <Field label="Tax">
              <MoneyInput value={tax} onChange={setTax} />
            </Field>
            <Field label="Tip">
              <MoneyInput value={tip} onChange={setTip} />
            </Field>
          </section>
        )}

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
        {activeMode.label.toLowerCase()} · tax &amp; tip are shared proportionally
      </p>
    </div>
  );
}
