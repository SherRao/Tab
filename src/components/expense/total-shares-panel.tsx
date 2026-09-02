"use client";

import { useState } from "react";
import { formatCents, toFixedMoney, toCents } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";

type WeightType = "equal" | "percent" | "amount";

export interface ShareConfig {
  participantId: number;
  weightType: WeightType;
  weightValue: number;
}

interface TotalSharesPanelProps {
  participants: { id: number; name: string }[];
  shares: ShareConfig[];
  totalCents: number;
  onChange: (shares: ShareConfig[]) => void;
}

export function TotalSharesPanel({
  participants,
  shares,
  totalCents,
  onChange,
}: TotalSharesPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);

  function updateShare(participantId: number, patch: Partial<ShareConfig>) {
    onChange(
      shares.map((s) => (s.participantId === participantId ? { ...s, ...patch } : s)),
    );
  }

  return (
    <section>
      <h2 className="label-mono text-stone-500">Shares</h2>
      <ul className="mt-2 space-y-2">
        {shares.map((share) => {
          const participant = participants.find((p) => p.id === share.participantId);
          if (!participant) return null;

          const display =
            share.weightType === "equal"
              ? "Equal"
              : share.weightType === "percent"
                ? `${(share.weightValue / 100).toFixed(0)}%`
                : formatCents(share.weightValue);

          return (
            <li key={share.participantId} className="flex items-center justify-between border border-dashed border-foreground/20 bg-background/60 px-3 py-2">
              <span className="text-sm font-medium">{participant.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-stone-500">{display}</span>
                <button
                  type="button"
                  onClick={() => setEditingId(share.participantId)}
                  className="label-mono text-[11px] text-accent-strong transition hover:underline"
                >
                  Adjust
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editingId != null && (
        <ShareEditorModal
          share={shares.find((s) => s.participantId === editingId)!}
          totalCents={totalCents}
          otherShares={shares.filter((s) => s.participantId !== editingId)}
          onSave={(updated) => {
            updateShare(editingId, updated);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </section>
  );
}

interface ShareEditorModalProps {
  share: ShareConfig;
  totalCents: number;
  otherShares: ShareConfig[];
  onSave: (share: ShareConfig) => void;
  onCancel: () => void;
}

function ShareEditorModal({
  share,
  totalCents,
  otherShares,
  onSave,
  onCancel,
}: ShareEditorModalProps) {
  const [weightType, setWeightType] = useState<WeightType>(share.weightType);
  const [percentValue, setPercentValue] = useState(
    share.weightType === "percent" ? String(share.weightValue / 100) : "",
  );
  const [amountValue, setAmountValue] = useState(
    share.weightType === "amount" ? toFixedMoney(share.weightValue) : "",
  );

  const otherPercentTotal = otherShares
    .filter((s) => s.weightType === "percent")
    .reduce((a, s) => a + s.weightValue, 0);
  const otherAmountTotal = otherShares
    .filter((s) => s.weightType === "amount")
    .reduce((a, s) => a + s.weightValue, 0);

  const myPercent = weightType === "percent" ? (toCents(percentValue) || 0) * 100 : 0;
  const myAmount = weightType === "amount" ? toCents(amountValue) || 0 : 0;

  const remainingPercent = 10000 - otherPercentTotal - myPercent;
  const remainingAmount = totalCents - otherAmountTotal - myAmount;

  const isValid =
    (weightType === "equal") ||
    (weightType === "percent" && myPercent > 0 && remainingPercent >= 0) ||
    (weightType === "amount" && myAmount > 0 && remainingAmount >= 0);

  function handleSave() {
    if (!isValid) return;
    onSave({
      participantId: share.participantId,
      weightType,
      weightValue:
        weightType === "equal"
          ? 10000
          : weightType === "percent"
            ? myPercent
            : myAmount,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm border border-foreground/20 bg-paper p-6 shadow-lg">
        <h3 className="font-mono text-sm font-semibold">Edit share</h3>

        <div className="mt-4 flex gap-2">
          {(["equal", "percent", "amount"] as const).map((wt) => (
            <button
              key={wt}
              type="button"
              onClick={() => setWeightType(wt)}
              className={`flex-1 border px-3 py-2 text-xs font-mono transition ${
                weightType === wt
                  ? "border-accent-strong bg-accent/10 text-accent-strong"
                  : "border-foreground/20 hover:border-foreground/45"
              }`}
            >
              {wt === "equal" ? "Equal" : wt === "percent" ? "%" : "$"}
            </button>
          ))}
        </div>

        {weightType === "percent" && (
          <div className="mt-4">
            <Field label="Percent">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percentValue}
                  onChange={(e) => setPercentValue(e.target.value)}
                  className="input-ink w-24"
                />
                <span className="font-mono text-xs text-stone-400">%</span>
              </div>
            </Field>
            <p className="mt-1 font-mono text-[11px] text-stone-400">
              Remaining: {(remainingPercent / 100).toFixed(1)}%
            </p>
          </div>
        )}

        {weightType === "amount" && (
          <div className="mt-4">
            <Field label="Amount">
              <MoneyInput value={amountValue} onChange={setAmountValue} />
            </Field>
            <p className="mt-1 font-mono text-[11px] text-stone-400">
              Remaining: {formatCents(remainingAmount)}
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="btn-ink flex-1 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
