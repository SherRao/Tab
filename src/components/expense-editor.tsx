"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveExpenseAction, updateExpenseAction } from "@/lib/actions";

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

function toCents(v: string): number {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

const MODES = [
  { value: "itemized", label: "By items", hint: "Tag who got what on each line" },
  { value: "even", label: "Even split", hint: "Divide the total between chosen people" },
  { value: "group", label: "Group", hint: "Everyone splits it all — birthday mode" },
] as const;

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
  const [splitMode, setSplitMode] = useState<"itemized" | "even" | "group">(
    initial?.splitMode ?? "itemized",
  );
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

  const amountInput = "input-ink pl-7 text-right font-mono tabular-nums";
  const activeMode = MODES.find((m) => m.value === splitMode)!;

  return (
    <div className="receipt-card receipt-edge">
      <div className="receipt-lined space-y-7 p-6 pb-8 sm:p-8 sm:pb-9">
        <div>
          <label className="label-mono block text-stone-500">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Lunch at Taco Place"
            className="input-ink mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-mono block text-stone-500">Paid by</label>
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
          </div>
          <div>
            <label className="label-mono block text-stone-500">Total</label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-stone-400">
                $
              </span>
              <input
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className={`${amountInput} font-semibold`}
              />
            </div>
          </div>
        </div>

        <section>
          <label className="label-mono block text-stone-500">How should this be split?</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSplitMode(m.value)}
                className={`border p-3 text-left transition ${
                  splitMode === m.value
                    ? "border-accent-strong bg-accent/10 shadow-sm"
                    : "border-foreground/20 hover:border-foreground/45"
                }`}
              >
                <span
                  className={`block font-mono text-[13px] font-semibold ${
                    splitMode === m.value ? "text-accent-strong" : ""
                  }`}
                >
                  {m.label}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-stone-400">{m.hint}</span>
              </button>
            ))}
          </div>
        </section>

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
                <li
                  key={idx}
                  className="border border-dashed border-foreground/25 bg-background/60 p-3.5"
                >
                  <div className="flex gap-2">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      placeholder="Item name"
                      className="input-ink py-2"
                    />
                    <div className="relative w-28 shrink-0">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-stone-400">
                        $
                      </span>
                      <input
                        value={item.amount}
                        onChange={(e) => updateItem(idx, { amount: e.target.value })}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`${amountInput} py-2 pr-2`}
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => assignAllToItem(idx)}
                      className="rounded-full border border-dashed border-stone-400 px-2.5 py-1 font-mono text-[11px] tracking-wide text-stone-500 uppercase transition hover:border-accent hover:text-accent-strong"
                    >
                      Everyone
                    </button>
                    {participants.map((p) => {
                      const on = item.participantIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleAssignee(idx, p.id)}
                          className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide uppercase transition active:scale-[0.95] ${
                            on
                              ? "bg-accent text-white shadow-sm"
                              : "bg-stone-200/70 text-stone-600 hover:bg-stone-300/70"
                          }`}
                        >
                          {on && "✓ "}
                          {p.name}
                        </button>
                      );
                    })}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-auto rounded-md px-2 py-1 font-mono text-[11px] tracking-wide text-red-400 uppercase transition hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-[11px] tracking-wide text-stone-400 tabular-nums uppercase">
              Items so far: ${formatMoney(computed.itemsSum)}
            </p>
          </section>
        )}

        {splitMode === "even" && (
          <section>
            <h2 className="label-mono text-stone-500">Split between</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {participants.map((p) => {
                const on = evenIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setEvenIds((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                      )
                    }
                    className={`rounded-full px-3 py-1.5 font-mono text-xs font-medium tracking-wide uppercase transition active:scale-[0.95] ${
                      on
                        ? "bg-accent text-white shadow-sm"
                        : "bg-stone-200/70 text-stone-600 hover:bg-stone-300/70"
                    }`}
                  >
                    {on && "✓ "}
                    {p.name}
                  </button>
                );
              })}
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
            <div>
              <label className="label-mono block text-stone-500">Tax</label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-stone-400">
                  $
                </span>
                <input
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={amountInput}
                />
              </div>
            </div>
            <div>
              <label className="label-mono block text-stone-500">Tip</label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-stone-400">
                  $
                </span>
                <input
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={amountInput}
                />
              </div>
            </div>
          </section>
        )}

        {computed.discrepancy !== 0 && (
          <p className="border-l-4 border-l-amber-400 bg-amber-50 px-4 py-3 font-mono text-xs leading-relaxed text-amber-800">
            Items ({formatMoney(computed.itemsSum)}) + tax + tip = {formatMoney(computed.expected)},
            but the total you entered is {formatMoney(toCents(total))} (
            {computed.discrepancy > 0 ? "+" : ""}
            {formatMoney(computed.discrepancy)}). You can still save.
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
