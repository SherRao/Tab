"use client";

import { useState, type ReactNode } from "react";
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
  const groups = new Map<string | undefined, BreakdownItemView[]>();
  for (const item of breakdown.items) {
    const key = item.expenseDescription;
    const arr = groups.get(key);
    if (arr) arr.push(item);
    else groups.set(key, [item]);
  }
  const groupEntries = Array.from(groups.entries());

  return (
    <div className="mt-2 ml-[18px] border-l border-dashed border-foreground/10 pl-4 space-y-4 text-sm">
      {groupEntries.length > 0 && (
        <div className="space-y-3">
          <div className="label-mono text-stone-400">Your share by receipt</div>
          {groupEntries.map(([receipt, items]) => (
            <div key={receipt ?? "__none__"}>
              <div className="truncate text-xs font-semibold text-stone-600">
                {receipt || "Receipt"}
              </div>
              <ul className="mt-1 space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate italic text-stone-600">
                      {item.itemName === receipt ? "Your share" : item.itemName}
                      <span className="not-italic">
                        {item.itemAmountCents > item.shareCents && (
                          <span className="ml-1.5 text-[10px] uppercase text-stone-400">
                            · split
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-stone-500 shrink-0">
                      {formatCents(item.shareCents)}
                      {item.itemAmountCents > item.shareCents && (
                        <span className="ml-1 text-[11px] text-stone-400">
                          of {formatCents(item.itemAmountCents)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
 * Renders the whole balance row (via `left`/`right`) plus, when open, the
 * itemized breakdown panel *below* the row so the amount/arrow never reflow.
 * Receives fully serializable data; all money math happens on the server.
 */
export function BalanceBreakdown({
  participantId,
  netCents,
  breakdown,
  left,
  right,
}: {
  participantId: number;
  netCents: number;
  breakdown: ParticipantBreakdownView;
  left: ReactNode;
  right: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        {left}
        <div className="flex items-center gap-2">
          {right}
          {netCents !== 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="label-mono text-[11px] text-stone-400 transition hover:text-accent-strong hover:underline flex items-center gap-1"
              aria-expanded={open}
              aria-controls={`breakdown-${participantId}`}
            >
              {open ? "▲" : "▼"} breakdown
            </button>
          )}
        </div>
      </div>
      {open && (
        <div id={`breakdown-${participantId}`} className="mt-2">
          <BreakdownPanel breakdown={breakdown} />
        </div>
      )}
    </>
  );
}
