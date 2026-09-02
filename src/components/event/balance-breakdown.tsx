"use client";

import { useState } from "react";
import { formatCents } from "@/lib/format";

export interface BreakdownItemView {
  expenseDescription: string | undefined;
  itemName: string;
  itemAmountCents: number;
  shareCents: number;
}

export interface ParticipantBreakdownView {
  items: BreakdownItemView[];
  taxShareCents: number;
  tipShareCents: number;
  otherExtrasShareCents: number;
  totalConsumedCents: number;
  totalPaidCents: number;
  netCents: number;
}

function BreakdownPanel({ breakdown }: { breakdown: ParticipantBreakdownView }) {
  return (
    <div className="mt-2 ml-[18px] border-l border-dashed border-foreground/10 pl-4 space-y-2 text-sm">
      {breakdown.items.length > 0 && (
        <>
          <div className="label-mono text-stone-400">Items</div>
          <ul className="space-y-1">
            {breakdown.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-2 text-[13px]">
                <span className="truncate">{item.itemName}</span>
                <span className="font-mono tabular-nums text-stone-500 shrink-0">
                  {formatCents(item.shareCents)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {(breakdown.taxShareCents > 0 ||
        breakdown.tipShareCents > 0 ||
        breakdown.otherExtrasShareCents > 0) && (
        <div className="label-mono text-stone-400">Tax & tip share</div>
      )}
      {breakdown.taxShareCents > 0 && (
        <div className="flex justify-between gap-2 text-[13px]">
          <span>Tax</span>
          <span className="font-mono tabular-nums text-stone-500 shrink-0">
            {formatCents(breakdown.taxShareCents)}
          </span>
        </div>
      )}
      {breakdown.tipShareCents > 0 && (
        <div className="flex justify-between gap-2 text-[13px]">
          <span>Tip</span>
          <span className="font-mono tabular-nums text-stone-500 shrink-0">
            {formatCents(breakdown.tipShareCents)}
          </span>
        </div>
      )}
      {breakdown.otherExtrasShareCents > 0 && (
        <div className="flex justify-between gap-2 text-[13px]">
          <span>Other</span>
          <span className="font-mono tabular-nums text-stone-500 shrink-0">
            {formatCents(breakdown.otherExtrasShareCents)}
          </span>
        </div>
      )}
      <div className="border-t border-dashed border-foreground/10 pt-2 flex justify-between gap-2">
        <span className="font-medium">Total consumed</span>
        <span className="font-mono tabular-nums font-semibold text-stone-700 shrink-0">
          {formatCents(breakdown.totalConsumedCents)}
        </span>
      </div>
      <div className="flex justify-between gap-2 text-[13px]">
        <span>Paid</span>
        <span className="font-mono tabular-nums text-stone-500 shrink-0">
          {formatCents(breakdown.totalPaidCents)}
        </span>
      </div>
      <div
        className={`border-t border-dashed border-foreground/10 pt-2 flex justify-between gap-2 ${
          breakdown.netCents > 0
            ? "text-accent-strong"
            : breakdown.netCents < 0
              ? "text-orange-600"
              : ""
        }`}
      >
        <span className="font-medium">
          {breakdown.netCents > 0
            ? "Gets back"
            : breakdown.netCents < 0
              ? "Owes"
              : "Settled"}
        </span>
        <span className="font-mono tabular-nums font-semibold shrink-0">
          {formatCents(Math.abs(breakdown.netCents))}
        </span>
      </div>
    </div>
  );
}

/**
 * Renders the toggle button + (when open) the itemized breakdown for a single
 * participant. Receives fully serializable data; all money math happens on the
 * server.
 */
export function BalanceBreakdown({
  participantId,
  netCents,
  breakdown,
}: {
  participantId: number;
  netCents: number;
  breakdown: ParticipantBreakdownView;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = open;

  if (netCents === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="label-mono text-[11px] text-stone-400 transition hover:text-accent-strong hover:underline flex items-center gap-1"
        aria-expanded={isOpen}
      >
        {isOpen ? "▲" : "▼"} breakdown
      </button>
      {isOpen && <BreakdownPanel breakdown={breakdown} />}
    </>
  );
}
