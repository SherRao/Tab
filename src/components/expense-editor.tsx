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
  { value: "itemized", label: "By items", hint: "Tag who got what on each line", icon: "🧾" },
  { value: "even", label: "Even split", hint: "Divide the total between chosen people", icon: "➗" },
  { value: "group", label: "Group", hint: "Everyone splits it all — birthday mode 🎂", icon: "🎂" },
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

  const inputCls =
    "w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none";
  const activeMode = MODES.find((m) => m.value === splitMode)!;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Lunch at Taco Place"
          className={`mt-1.5 ${inputCls}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Paid by</label>
          <select
            value={payerId ?? ""}
            onChange={(e) => setPayerId(Number(e.target.value))}
            className={`mt-1.5 ${inputCls}`}
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
          <label className="block text-sm font-medium">Total</label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400">
              $
            </span>
            <input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className={`${inputCls} pl-7 text-right font-semibold tabular-nums`}
            />
          </div>
        </div>
      </div>

      <section>
        <label className="block text-sm font-medium">How should this be split?</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setSplitMode(m.value)}
              className={`rounded-xl border p-3 text-left transition ${
                splitMode === m.value
                  ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              <span
                className={`mt-1 block text-sm font-semibold ${
                  splitMode === m.value ? "text-emerald-800" : ""
                }`}
              >
                {m.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">
                {m.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      {splitMode === "itemized" && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Line items</h2>
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [...prev, { name: "", amount: "", participantIds: [] }])
              }
              className="rounded-lg px-2 py-1 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              + Add item
            </button>
          </div>
          <ul className="mt-2 space-y-3">
            {items.map((item, idx) => (
              <li key={idx} className="rounded-xl border border-stone-200/70 bg-white p-3.5 shadow-sm">
                <div className="flex gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    placeholder="Item name"
                    className={`${inputCls} py-2`}
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400">
                      $
                    </span>
                    <input
                      value={item.amount}
                      onChange={(e) => updateItem(idx, { amount: e.target.value })}
                      placeholder="0.00"
                      inputMode="decimal"
                      className={`${inputCls} py-2 pr-2 pl-7 text-right tabular-nums`}
                    />
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => assignAllToItem(idx)}
                    className="rounded-full border border-dashed border-stone-400 px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:border-emerald-500 hover:text-emerald-700"
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
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-[0.95] ${
                          on
                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
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
                      className="ml-auto rounded-md px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs tabular-nums text-stone-400">
            Items so far: ${formatMoney(computed.itemsSum)}
          </p>
        </section>
      )}

      {splitMode === "even" && (
        <section>
          <h2 className="text-sm font-semibold">Split between</h2>
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
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-[0.95] ${
                    on
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
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
        <p className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
          <span className="text-base">🎂</span>
          Everyone in the event splits the whole total equally.
        </p>
      )}

      {(splitMode === "itemized" || splitMode === "group") && (
        <section className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Tax</label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400">
                $
              </span>
              <input
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className={`${inputCls} pl-7 text-right tabular-nums`}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Tip</label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400">
                $
              </span>
              <input
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className={`${inputCls} pl-7 text-right tabular-nums`}
              />
            </div>
          </div>
        </section>
      )}

      {computed.discrepancy !== 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Items ({formatMoney(computed.itemsSum)}) + tax + tip ={" "}
          {formatMoney(computed.expected)}, but the total you entered is{" "}
          {formatMoney(toCents(total))} ({computed.discrepancy > 0 ? "+" : ""}
          {formatMoney(computed.discrepancy)}). You can still save.
        </p>
      )}
      {splitMode === "itemized" && computed.unassigned > 0 && (
        <p className="text-sm text-amber-700">
          ⚠️ {computed.unassigned} line item{computed.unassigned > 1 ? "s" : ""}{" "}
          ha{computed.unassigned > 1 ? "ve" : "s"} no assignees yet.
        </p>
      )}

      <div className="sticky bottom-0 -mx-6 flex gap-3 border-t border-stone-200/70 bg-background/90 px-6 py-4 backdrop-blur">
        <button
          type="button"
          disabled={saving || payerId === undefined}
          onClick={handleSave}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? "Saving…" : expenseId ? "Save changes" : "Save expense"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/e/${token}`)}
          className="rounded-lg border border-stone-300 px-5 py-3 font-medium text-stone-600 transition hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>
      <p className="-mt-4 text-center text-xs text-stone-400">
        Split mode: {activeMode.label.toLowerCase()} · tax &amp; tip are shared proportionally
      </p>
    </div>
  );
}
