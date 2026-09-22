## Why

Today Tab tells participants what they *should* pay each other via the simplified settlement view, but has no idea whether those transfers actually happened. Balances stay stuck showing the same debt long after Venmo has cleared it. Users need a way to record that "I paid X $Y" so the ledger reflects reality, and so a friend group can see when they're actually settled up.

## What Changes

- Add a **payment** record: a direct participant-to-participant transfer of money, separate from expenses.
- Fold payments into net balance math so recording a payment reduces the debt it settles (partial payments supported — each payment is its own row and balances net out).
- Add a **"Record a payment"** entry point on the event page, and a **"Mark as paid"** shortcut on each row of the settle-up suggestions that pre-fills the form with the suggested amount (editable).
- Show a **payment history** list inline under the settle-up section on the event page.
- Restrict payment logging: **only the paying participant can log a payment they made**. This requires the viewer to be signed in and claimed to the "from" participant; guests see a prompt to sign in and claim themselves. No receiver confirmation — the log updates balances immediately, and the payer can edit or delete the row.
- Payments carry an optional short note (e.g., "Venmo", "cash").

## Capabilities

### New Capabilities
- `payments`: Recording direct participant-to-participant payments on an event, including auth rules, editing, and history display.

### Modified Capabilities
- `balances`: Net balance derivation and debt simplification now fold in payment records alongside expenses.

## Impact

- Data: new `payments` table (`event_id`, `from_participant_id`, `to_participant_id`, `amount_cents`, `note`, `created_at`).
- Ledger math: `src/lib/ledger.ts` gains a payments input; `computeNetBalances` and `computeParticipantBreakdown` adjust net using `received − sent` payments.
- Queries + actions: `src/lib/queries.ts` reads payments for the event; `src/lib/actions.ts` adds create/edit/delete server actions with the payer-only auth check.
- UI: new payment editor component and history list in `src/components/event/`; the existing `settle-up-list` gains a "Mark as paid" affordance per suggested transfer.
- Auth: no new schema, but payment write actions require a session whose user has an approved claim on the "from" participant.
- Non-goal: no receiver-confirmation workflow, no "settled since" running state, no linking a payment to a specific expense or suggested transfer.
