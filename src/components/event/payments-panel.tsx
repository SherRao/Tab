"use client";

import { useState } from "react";
import { formatCents } from "@/lib/format";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  PaymentEditor,
  type EditorParticipant,
  type PaymentEditorState,
} from "@/components/payment/payment-editor";

export interface PanelTransfer {
  fromId: number;
  toId: number;
  amountCents: number;
}

export interface PanelPaymentRow {
  id: number;
  fromParticipantId: number;
  toParticipantId: number;
  amountCents: number;
  note: string | null;
  createdAt: Date;
}

interface PaymentsPanelProps {
  token: string;
  transfers: PanelTransfer[];
  history: PanelPaymentRow[];
  participants: EditorParticipant[];
  nameOf: Map<number, string>;
  viewerParticipantId: number | null;
  claimHref: string;
}

const CLOSED: PaymentEditorState = { open: false };

function formatWhen(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PaymentsPanel({
  token,
  transfers,
  history,
  participants,
  nameOf,
  viewerParticipantId,
  claimHref,
}: PaymentsPanelProps) {
  const [state, setState] = useState<PaymentEditorState>(CLOSED);

  const viewerParticipant =
    viewerParticipantId != null
      ? (participants.find((p) => p.id === viewerParticipantId) ?? null)
      : null;
  const otherParticipants = participants.filter((p) => p.id !== viewerParticipantId);

  function openFreeForm() {
    setState({ open: true });
  }

  function openMarkAsPaid(transfer: PanelTransfer) {
    setState({
      open: true,
      initialToId: transfer.toId,
      initialAmountCents: transfer.amountCents,
    });
  }

  function openEdit(row: PanelPaymentRow) {
    setState({
      open: true,
      editingPaymentId: row.id,
      initialToId: row.toParticipantId,
      initialAmountCents: row.amountCents,
      initialNote: row.note,
    });
  }

  const canPayFromRow = (fromId: number) => viewerParticipantId != null && fromId === viewerParticipantId;

  return (
    <section className="mt-12">
      <SectionHeading>Settle up</SectionHeading>

      {transfers.length === 0 ? (
        <div className="receipt-card receipt-lined mt-4 p-8 pb-9 text-center">
          <span className="stamp">all settled ✓</span>
          <p className="mt-3 font-mono text-xs text-stone-400">nothing to transfer right now</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {transfers.map((t, i) => {
            const iCanPay = canPayFromRow(t.fromId);
            return (
              <li key={i} className="paper-card flex items-center justify-between px-4 py-3">
                <span className="text-sm">
                  <strong>{nameOf.get(t.fromId)}</strong>
                  <span className="mx-2 inline-block -translate-y-[1px] font-mono text-accent">
                    ⟶
                  </span>
                  <strong>{nameOf.get(t.toId)}</strong>
                </span>
                <span className="flex items-center gap-2">
                  <span className="border border-accent-strong/60 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-accent-strong">
                    {formatCents(t.amountCents)}
                  </span>
                  {iCanPay && (
                    <button
                      type="button"
                      onClick={() => openMarkAsPaid(t)}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      Mark as paid
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <button type="button" onClick={openFreeForm} className="btn-ink px-3 py-1.5 text-sm">
          Record a payment
        </button>
      </div>

      <PaymentEditor
        token={token}
        state={state}
        onClose={() => setState(CLOSED)}
        viewerParticipant={viewerParticipant}
        claimHref={claimHref}
        otherParticipants={otherParticipants}
      />

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="label-mono text-xs uppercase text-stone-500">Payment history</h3>
          <ul className="mt-3 space-y-2">
            {history.map((row) => {
              const mine = viewerParticipantId != null && row.fromParticipantId === viewerParticipantId;
              return (
                <li
                  key={row.id}
                  className="paper-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex flex-col text-sm">
                    <span>
                      <strong>{nameOf.get(row.fromParticipantId)}</strong>{" "}
                      paid{" "}
                      <strong>{nameOf.get(row.toParticipantId)}</strong>{" "}
                      <span className="font-mono tabular-nums">
                        {formatCents(row.amountCents)}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-stone-400">
                      {formatWhen(row.createdAt)}
                      {row.note ? ` · ${row.note}` : ""}
                    </span>
                  </span>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
