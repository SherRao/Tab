"use client";

import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/ui/money-input";
import { ErrorNote } from "@/components/ui/error-note";
import { toCents, toFixedMoney } from "@/lib/format";
import {
  createPaymentAction,
  deletePaymentAction,
  updatePaymentAction,
} from "@/lib/actions";

// Mirrors the server-side cap in actions.ts; if this ever drifts, the server rejects long notes.
const MAX_NOTE_LEN = 200;

export interface EditorParticipant {
  id: number;
  displayName: string;
}

export interface PaymentEditorState {
  open: boolean;
  editingPaymentId?: number;
  initialToId?: number;
  initialAmountCents?: number;
  initialNote?: string | null;
}

interface PaymentEditorProps {
  token: string;
  state: PaymentEditorState;
  onClose: () => void;
  viewerParticipant: EditorParticipant | null;
  claimHref: string;
  otherParticipants: EditorParticipant[];
}

export function PaymentEditor(props: PaymentEditorProps) {
  if (!props.state.open) return null;
  // Key on the id/free-form flag so reopening resets local form state naturally.
  const editingId = props.state.editingPaymentId ?? "new";
  return <PaymentEditorOpen key={editingId} {...props} />;
}

function PaymentEditorOpen({
  token,
  state,
  onClose,
  viewerParticipant,
  claimHref,
  otherParticipants,
}: PaymentEditorProps) {
  const [toId, setToId] = useState<number | null>(state.initialToId ?? null);
  const [amount, setAmount] = useState<string>(
    state.initialAmountCents != null ? toFixedMoney(state.initialAmountCents) : "",
  );
  const [note, setNote] = useState<string>(state.initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isEditing = state.editingPaymentId != null;

  if (!viewerParticipant) {
    return (
      <div className="paper-card mt-4 p-6">
        <p className="font-mono text-sm text-stone-600">
          Sign in and claim your participant on this tab before recording a payment.
        </p>
        <div className="mt-4 flex gap-2">
          <a href={claimHref} className="btn-ink px-3 py-1.5 text-sm">
            Sign in
          </a>
          <button type="button" onClick={onClose} className="btn-ghost px-3 py-1.5 text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  function submit() {
    setError(null);
    const cents = toCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    if (toId == null) {
      setError("Pick a recipient.");
      return;
    }
    const trimmedNote = note.trim() || undefined;
    startTransition(async () => {
      try {
        if (isEditing) {
          await updatePaymentAction(token, state.editingPaymentId!, {
            amountCents: cents,
            note: trimmedNote ?? null,
            toParticipantId: toId,
          });
        } else {
          await createPaymentAction(token, {
            toParticipantId: toId,
            amountCents: cents,
            note: trimmedNote,
          });
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    if (!isEditing) return;
    if (!confirm("Delete this payment?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePaymentAction(token, state.editingPaymentId!);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="paper-card mt-4 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="label-mono text-xs uppercase">
          {isEditing ? "Edit payment" : "Record a payment"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost px-2 py-1 text-xs"
          disabled={pending}
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label-mono text-[10px] uppercase text-stone-500">From</span>
          <div className="input-ink mt-1.5 bg-stone-50 text-stone-700">
            {viewerParticipant.displayName}
          </div>
        </label>

        <label className="block">
          <span className="label-mono text-[10px] uppercase text-stone-500">To</span>
          <select
            value={toId ?? ""}
            onChange={(e) => setToId(e.target.value ? Number(e.target.value) : null)}
            className="input-ink mt-1.5"
            aria-label="Recipient"
          >
            <option value="">Pick a person…</option>
            {otherParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-mono text-[10px] uppercase text-stone-500">Amount</span>
          <MoneyInput value={amount} onChange={setAmount} ariaLabel="Amount" />
        </label>

        <label className="block">
          <span className="label-mono text-[10px] uppercase text-stone-500">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Venmo, cash, …"
            maxLength={MAX_NOTE_LEN}
            className="input-ink mt-1.5"
            aria-label="Note"
          />
        </label>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote variant="form">{error}</ErrorNote>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {isEditing ? (
          <button
            type="button"
            onClick={remove}
            className="btn-ghost px-3 py-1.5 text-xs text-red-700"
            disabled={pending}
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={submit}
          className="btn-ink px-4 py-2 text-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : isEditing ? "Save changes" : "Record payment"}
        </button>
      </div>
    </div>
  );
}
