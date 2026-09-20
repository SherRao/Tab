## 1. Schema and data access

- [x] 1.1 Add `payments` table to `src/db/schema.ts` with columns `id`, `eventId`, `fromParticipantId`, `toParticipantId`, `amountCents`, `note` (nullable), `createdAt`, plus an index on `eventId`; verify by running `npm run db:generate` and inspecting the generated migration for the new table + index.
- [x] 1.2 Add drizzle relations for `payments` (event, from-participant, to-participant); verify `npm run build` type-checks and no relation is unused.
- [x] 1.3 Run `npm run db:migrate` against `data/app.db`; verify the `payments` table exists via a sqlite inspection (e.g. `sqlite3 data/app.db ".schema payments"`).
- [x] 1.4 Add `getPaymentsForEvent(eventId)` in `src/lib/queries.ts` returning rows ordered by `createdAt` desc; verify with a unit test in `src/lib/__tests__/` that inserts and reads back payments for an event.

## 2. Ledger math

- [x] 2.1 Add `LedgerPayment` type and a `payments` parameter to `computeNetBalances` and `computeParticipantBreakdown` in `src/lib/ledger.ts`; fold `sent − received` into each participant's net (sign chosen so a payer's positive send offsets their negative net). Verify with a new vitest case: A pays $60, B consumes $30, B records $30 payment → both nets are 0.
- [x] 2.2 Extend `computeParticipantBreakdown` to return a `payments` section listing payments sent and received for that participant; verify with a vitest case asserting the section is populated and totals reconcile with `netCents`.
- [x] 2.3 Add scenarios to the existing ledger test covering: partial payment reducing debt, overpayment flipping direction, deletion reversing effect. Verify `npm test` passes.

## 3. Server actions and auth

- [x] 3.1 Add `createPaymentAction(token, { toParticipantId, amountCents, note? })` in `src/lib/actions.ts` that resolves the acting participant from `participants.userId` on the event (set when the owner approves a claim via `linkAccountToParticipant`), rejects if unclaimed, rejects if `to === from` or `to` is not in the event, enforces a positive cents bound, and inserts a row. Covered by `payments-actions.integration.test.ts` (unclaimed rejected, stranger rejected, valid payer inserts, self/non-participant rejected, out-of-range amounts rejected).
- [x] 3.2 Add `updatePaymentAction(token, paymentId, { amountCents?, note?, toParticipantId? })` that re-verifies the acting participant equals the row's `fromParticipantId`; test covers non-payer rejected.
- [x] 3.3 Add `deletePaymentAction(token, paymentId)` with the same claim check; test covers payer allowed and non-payer rejected.
- [x] 3.4 Each action calls `revalidatePath("/e/${token}")` after a successful write.

## 4. UI: editor and history

- [x] 4.1 Create `src/components/payment/payment-editor.tsx` (client component) with recipient dropdown, money input, and optional note. "From" is read-only and shows the viewer's claimed participant; unclaimed viewers see a sign-in nudge instead of the form. Delete affordance surfaces when editing.
- [x] 4.2 Free-form "Record a payment" button lives in `PaymentsPanel` (rather than a separate `record-payment-button.tsx`) so a single editor state is shared with the settle-up rows and history.
- [x] 4.3 `PaymentsPanel` renders the payment history inline (sender → recipient, amount, date, note). Edit affordance shows only for rows the viewer paid; edit opens the shared editor pre-filled with delete inside.
- [x] 4.4 `PaymentsPanel` replaces the previous `SettleUpList` in `src/app/(app)/e/[token]/page.tsx`; layout: suggestions → Record button → editor → history. The old `settle-up-list.tsx` file is removed since the panel supersedes it.
- [x] 4.5 Each suggested transfer row in `PaymentsPanel` gains a "Mark as paid" button (rendered only for the viewer's own outgoing suggestions) that opens the editor pre-filled with the suggested recipient and amount, still editable.

## 5. Integration + polish

- [x] 5.1 Edit and delete are wired via the shared `PaymentEditor`: Edit on a history row opens the editor for that payment, delete lives inside the editor with a `confirm()` prompt, both calling their respective server actions.
- [x] 5.2 `assertPositiveCents` in `src/lib/actions.ts` rejects zero, negatives, non-integers, and values above the 100_000_000-cent bound; covered by an action-level test.
- [x] 5.3 `AGENTS.md` now lists `payments-panel` under `event/`, adds a `payment/` folder entry, mentions the `payments` table, and documents the payer-only-with-session exception to the trust model.
- [x] 5.4 `npx tsc --noEmit` and `npx next build` compile the app cleanly; lint reports zero new problems (existing 38 are all in `tab-review/`); vitest passes 111/111 for our tests (the 6 failures are the same pre-existing `tab-review` verifications that fail on main).
- [ ] 5.5 Manual QA on `npm run dev` — deferred; requires a human to sign in as two participants and exercise the full round-trip in the browser. Ledger math, actions, and auth are all covered by tests; UI wiring is compile-verified but has not been driven interactively.
