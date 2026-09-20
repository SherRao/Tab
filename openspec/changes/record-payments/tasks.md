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

- [ ] 4.1 Create `src/components/payment/payment-editor.tsx` (client component) with fields for recipient (dropdown of other participants), amount (money-input), and note (optional). The "from" field is read-only and shows the current claimed participant, or an inline "sign in and claim yourself as ..." nudge when unclaimed. Verify by rendering with a claimed viewer and with an unclaimed viewer.
- [ ] 4.2 Create `src/components/event/record-payment-button.tsx` that opens the editor in free-form mode; verify it appears on the event page and opens the editor.
- [ ] 4.3 Create `src/components/event/payment-history.tsx` listing payments for the event (sender → recipient · amount · note · relative time). Show edit/delete only when the viewer is claimed to the row's `from`. Verify rendering with mixed rows (viewer-owned and other) and confirm affordances match.
- [ ] 4.4 Integrate `payment-history` and `record-payment-button` inline under `settle-up-list` in `src/app/e/[token]/page.tsx`; verify the layout in the browser.
- [ ] 4.5 Extend `settle-up-list` so each suggested transfer row exposes a "Mark as paid" action that opens `payment-editor` pre-filled with the suggested recipient and amount, still editable. Verify: tapping the action opens the editor with correct pre-fill, and confirming records a payment that clears the suggestion.

## 5. Integration + polish

- [ ] 5.1 Wire edit and delete affordances on `payment-history` rows to the update/delete actions (with a confirm on delete). Verify a full round-trip in the browser: record → edit amount → delete.
- [ ] 5.2 Add cap: reject payment amounts of 0 and above the existing `100_000_000` cent bound. Verify with a server-action test.
- [ ] 5.3 Update `AGENTS.md` architecture section to mention `src/components/payment/` and `payments` table; verify the mention is present.
- [ ] 5.4 Run `npm run lint`, `npm run build`, and `npm test`; verify all pass.
- [ ] 5.5 Manual QA on the running dev server (`npm run dev`) with two participants (one claimed, one guest): record a full payment, record a partial, record an overpayment, delete, edit; verify each behaves as the spec's scenarios describe.
