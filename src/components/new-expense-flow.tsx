"use client";

import { useState } from "react";
import type { ReceiptDraft } from "@/lib/receipt-parse";
import type { EditorItem } from "@/components/expense-editor";
import ExpenseEditor, { type EditorParticipant } from "@/components/expense-editor";
import ScanReceipt, { type ScanOutcome } from "@/components/scan-receipt";

type Stage = "choose" | "editor";

export default function NewExpenseFlow({
  token,
  participants,
}: {
  token: string;
  participants: EditorParticipant[];
}) {
  const [stage, setStage] = useState<Stage>("choose");
  const [initial, setInitial] = useState<Parameters<typeof ExpenseEditor>[0]["initial"]>();
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  function applyDraft(draft: ReceiptDraft, outcome: Exclude<ScanOutcome, { status: "error" }>["status"]) {
    const scannedItems: EditorItem[] = draft.items.map((i) => ({
      name: i.name,
      amount: (i.amountCents / 100).toFixed(2),
      participantIds: [],
    }));
    setInitial({
      description: "",
      payerId: undefined,
      items: scannedItems.length > 0 ? scannedItems : [{ name: "", amount: "", participantIds: [] }],
      tax: draft.taxCents ? (draft.taxCents / 100).toFixed(2) : "",
      tip: draft.tipCents ? (draft.tipCents / 100).toFixed(2) : "",
      total: draft.totalCents ? (draft.totalCents / 100).toFixed(2) : "",
      splitMode: "itemized",
      evenParticipantIds: [],
    });
    setScanNotice(
      outcome === "success"
        ? "Scanned from your receipt — please review the details before saving."
        : "We couldn't read that receipt clearly — here's what we recognized. Please complete it by hand.",
    );
    setStage("editor");
  }

  function handleOutcome(outcome: ScanOutcome) {
    if (outcome.status === "error") return;
    applyDraft(outcome.draft, outcome.status);
  }

  if (stage === "choose") {
    return (
      <div className="space-y-4">
        <ScanReceipt onDone={handleOutcome} onCancel={() => setStage("editor")} />
        <button
          type="button"
          onClick={() => setStage("editor")}
          className="w-full rounded-xl border border-stone-200/70 bg-white px-4 py-3 text-sm font-medium text-stone-600 shadow-sm transition hover:bg-stone-50"
        >
          Skip — type it in manually
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scanNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>✓ {scanNotice}</span>
          <button
            type="button"
            onClick={() => {
              setScanNotice(null);
              setInitial(undefined);
              setStage("choose");
            }}
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Re-scan
          </button>
        </div>
      )}
      <ExpenseEditor token={token} participants={participants} initial={initial} />
    </div>
  );
}
