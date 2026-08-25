"use client";

import { useState } from "react";
import type { ReceiptDraft } from "@/lib/receipt-parse";
import type { EditorItem } from "@/components/expense-editor";
import ExpenseEditor, { type EditorParticipant } from "@/components/expense-editor";
import ScanReceipt, { type ScanOutcome } from "@/components/scan-receipt";

type Stage = "choose" | "editor";

export interface NewExpenseFlowProps {
  token: string;
  participants: EditorParticipant[];
  editorInitial?: {
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

export default function NewExpenseFlow({
  token,
  participants,
  editorInitial,
}: NewExpenseFlowProps) {
  const [initial, setInitial] = useState<Parameters<typeof ExpenseEditor>[0]["initial"]>(
    editorInitial ?? {
      description: "",
      payerId: undefined,
      items: [{ name: "", amount: "", participantIds: [] }],
      tax: "",
      tip: "",
      total: "",
      splitMode: "itemized",
      evenParticipantIds: [],
      groupIds: undefined,
    },
  );
  const [stage, setStage] = useState<Stage>("choose");
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  function applyDraft(
    draft: ReceiptDraft,
    outcome: Exclude<ScanOutcome, { status: "error" }>["status"],
  ) {
    const scannedItems: EditorItem[] = draft.items.map((i) => ({
      name: i.name,
      amount: (i.amountCents / 100).toFixed(2),
      participantIds: [],
    }));
    setInitial({
      description: "",
      payerId: undefined,
      items:
        scannedItems.length > 0 ? scannedItems : [{ name: "", amount: "", participantIds: [] }],
      tax: draft.taxCents ? (draft.taxCents / 100).toFixed(2) : "",
      tip: draft.tipCents ? (draft.tipCents / 100).toFixed(2) : "",
      total: draft.totalCents ? (draft.totalCents / 100).toFixed(2) : "",
      splitMode: "itemized",
      evenParticipantIds: [],
      groupIds: [],
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
        <button type="button" onClick={() => setStage("editor")} className="btn-ghost w-full">
          Skip — type it in manually
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scanNotice && (
        <div className="flex items-start justify-between gap-3 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent-strong">
          <span>✓ {scanNotice}</span>
          <button
            type="button"
            onClick={() => {
              setScanNotice(null);
              setInitial(undefined);
              setStage("choose");
            }}
            className="shrink-0 px-2 py-0.5 font-semibold uppercase transition hover:underline"
          >
            Re-scan
          </button>
        </div>
      )}
      <ExpenseEditor token={token} participants={participants} initial={initial} />
    </div>
  );
}
