## Context

See proposal.md — Why. Tab's ledger currently derives balances entirely from `expenses`, and the settle-up view is a *suggestion* with no persisted counterpart. Identity already exists in the schema (`users`, `sessions`, `participant_claims` with an `approved` status) but writes elsewhere on the event page follow a trust model gated only by the share token. Money is integer cents end-to-end (`src/lib/format.ts`); the ledger core is a pure function in `src/lib/ledger.ts`.

## Goals / Non-Goals

**Goals:**
- Add a persisted payment record and fold it into the pure ledger math with no changes to how expenses are represented.
- Introduce a payer-only auth check as a scoped exception to Tab's trust model, without wiring auth into unrelated write paths.
- Keep the ledger function pure and easy to test — payments should look to the math like a small, orthogonal input alongside expenses.

**Non-Goals:**
- Linking a payment to a specific expense, a specific suggested transfer, or a "settled since" epoch.
- A receiver-confirmation workflow, pending state, or notifications.
- Reworking auth for expenses or any other write path on the event page.
- A separate "payments" tab or full-page view — history renders inline under settle-up.

## Decisions

### D1. Separate `payments` table, not a degenerate expense

Alternative considered: model a payment as an expense with `payer = sender`, one line item consumed 100% by the recipient. Reuses existing plumbing but pollutes the receipt list, muddies the "consumed" concept, and forces the receipt UI to special-case payment rows anyway.

**Chosen**: new `payments` table with columns `id`, `event_id`, `from_participant_id`, `to_participant_id`, `amount_cents`, `note (nullable)`, `created_at`. Foreign keys `on delete cascade` on `event_id`, `on delete restrict` on both participant refs (deleting a participant with recorded payments requires resolving them first, same posture as `expenses.payerId`). Add index on `event_id`.

**Why**: keeps expenses and payments cleanly separate in storage and in UI, makes the ledger math a small additive change, and avoids leaking payment concerns into the receipt list, line-item shares, and tax/tip logic.

### D2. Ledger math: `net = paid − consumed + sent − received`

`computeConsumption` stays unchanged. Introduce a small pass over payments producing two maps (`sent`, `received`) keyed by participant id. `computeNetBalances` takes an additional `payments: LedgerPayment[]` argument and folds those maps in. Sign check: if B owes A $30 and B pays A $30, B's payment "sent" cancels B's negative net; A's payment "received" cancels A's positive net. `computeParticipantBreakdown` gains a `payments` section on the returned shape so the per-person view can list "Paid to X: $Y" and "Received from Y: $Z" alongside the item breakdown.

Alternative: bake payments inside `computeConsumption` by adding artificial "expense-like" rows. Rejected — obscures what the math is doing and pollutes the extras allocation loop.

### D3. Payer-only auth: derive `from` from the session, not from the client

Alternative: accept a `fromParticipantId` in the payload and verify it matches an approved claim. Works, but the client can lie and the server has to re-check every field.

**Chosen**: server actions for payment write (`createPaymentAction`, `updatePaymentAction`, `deletePaymentAction`) resolve the acting participant server-side: `session → user → participant with an approved claim, scoped to this event`. Reject if none. The UI's "from" field is a read-only display of whichever participant the current viewer is claimed to. The recipient (`to`) still comes from the payload but must be a participant in the same event and cannot equal `from`.

**Why**: the auth boundary is the server, not the form. Guests / unclaimed viewers get a clear "sign in and claim your participant" nudge in the editor. Also prevents an attacker with the share token from spoofing payments from someone else.

### D4. History display is inline under settle-up

The existing settle-up section on `/e/[token]` renders `settle-up-list`. Add a `payment-history` component under it, plus a `record-payment-button` sibling that opens the free-form editor. The suggested-transfer rows in `settle-up-list` gain a "Mark as paid" affordance that opens the same editor pre-filled — same underlying record. Both entry points create rows in the same `payments` table.

If the current viewer is unclaimed, the "Record a payment" button and per-row "Mark as paid" links still render but open into a claim-prompt state instead of the payment form.

### D5. Edit and delete affordances are per-row, gated by claim

Each history row shows edit/delete only when the viewer is claimed to that row's `from` participant. Server actions re-verify the claim on write. No soft delete — deleting removes the row and the ledger recomputes on next revalidation.

## Risks / Trade-offs

- **[Guests are locked out of the feature.]** → Explicitly by design (see proposal). Mitigation: the editor states clearly "sign in and claim yourself as [Name] to record payments"; the claim-request flow already exists (`participantClaims`, `claim-requests` component).
- **[Payer-only breaks the muscle memory of Tab's trust model.]** → Mitigation: keep the exception narrow — only payment writes, not viewing or expenses — and surface the constraint in-place rather than as a global auth wall.
- **[Overpayments flip suggested settlement direction unexpectedly.]** → Behaviour is correct (B overpays A, so A now owes B). Mitigation: the editor could warn "You're paying more than you owe" if the entered amount exceeds the current suggested transfer, but this is a UI polish item, not a spec requirement.
- **[On-delete `restrict` on participant → payments blocks participant removal.]** → Mirrors how `expenses.payerId` already behaves. Removing a participant will require deleting or reassigning their payments first, which is consistent with the existing model.
- **[Payments carry no relationship to specific expenses.]** → Explicitly non-goal. Simpler math, simpler UI, matches Splitwise. If a group ever needs "which debt did this pay off," it's an additive change on top.

## Migration Plan

- Add a drizzle migration for the `payments` table and index; run `npm run db:generate` to produce it, `npm run db:migrate` to apply.
- No data backfill — existing events have no payments.
- Rollback: drop the table; balances revert to expenses-only. UI code lives behind the new components so removing them from the event page reverts the surface cleanly.
