## 1. Schema & Migration

- [x] 1.1 Add `expense_shares` table to `src/db/schema.ts` with indexes and relations; verify `npm run db:generate` produces migration
- [x] 1.2 Ensure `groups` and `participantGroup` tables exist (from participant-groups change); if missing, add them
- [x] 1.3 Write migration script `src/scripts/migrate-shares.ts` that:
  - Reads all expenses with their line items and shares
  - For `group` expenses: resolved set = all event participants
  - For `even` expenses: resolved set = `evenParticipantIds ?? groupIds` (post-`0001` field, falling back to legacy `group_ids`), else all participants
  - For `even`/`group`: inserts `expense_shares` rows with `lineItemId=NULL`, `weightType='equal'`, `weightValue=10000` for each resolved participant
  - For `itemized` expenses: inserts `expense_shares` per line item from `line_item_shares`
  - Run and verify row counts match expectations
- [x] 1.4 Apply migration to `data/app.db` via `npm run db:migrate`; verify no data loss
- [x] 1.5 Remove `group` from `SPLIT_MODES` enum in `schema.ts` and update `expenses` table `splitMode` column default to `itemized`
- [x] 1.6 After migration verified, drop the `even_participant_ids` and `group_ids` columns from `expenses` (both introduced since `0001_redundant_nemesis`); update `schemas.ts` `expenses` definition accordingly

## 2. Ledger Math (computeConsumption / computeParticipantBreakdown)

- [x] 2.1 Refactor `computeConsumption` in `src/lib/ledger.ts` to read from `expense_shares` instead of `evenParticipantIds`/`groupId`
- [x] 2.2 Implement participant resolution: union of explicit `participantId` rows + live `groupId` member lookup via `participantGroup`
- [x] 2.3 Implement weight computation per scope (total vs line item):
  - `equal` → weight = 1
  - `percent` → weight = `weightValue / 10000`
  - `amount` → exact cents allocation
- [x] 2.4 Handle mixed weight types in same scope: exact amounts first, remainder distributed proportionally
- [x] 2.5 Preserve tax/tip proportional allocation using pre-tax subtotals from shares
- [x] 2.6 Add fallback: if expense has no shares, use old logic (for any edge cases)
- [x] 2.7 Run `npm test` — all 38 existing ledger/integration tests must pass
- [x] 2.8 Extract the shared participant-resolution + weight-application helper from 2.2-2.4 so `computeConsumption` and `computeParticipantBreakdown` use one code path (breakdown currently duplicates ledger.ts:69-137 incl. the `even ? participantIds : participantIds` no-op)
- [x] 2.9 Update `computeParticipantBreakdown` (ledger.ts:197) to the shared helper from 2.8; add parity test that its totals reconcile with `computeConsumption` for weighted shares

## 3. Actions & Queries

- [x] 3.1 Update `ExpensePayload` in `src/lib/actions.ts`:
  - Remove `evenParticipantIds`, `groupIds`
  - Add `shares: { participantId?: number; groupId?: number; lineItemId?: number | null; weightType: 'equal' | 'percent' | 'amount'; weightValue: number }[]`
- [x] 3.2 Update `saveExpenseAction` to insert `expense_shares` rows from payload
- [x] 3.3 Update `updateExpenseAction` to replace `expense_shares` on edit
- [x] 3.4 Add validation in actions: percent sums to 10000, amount sums to totalCents
- [x] 3.5 Update `getExpenses` in `src/lib/queries.ts` to fetch `expense_shares` alongside expenses
- [x] 3.6 Run `npm test` — all integration tests pass

## 4. Editor UI: Core Components

- [x] 4.1 Replace `SplitModeSelector` with `WhatModeSelector` (By items / As a total tiles) in `src/components/expense/split-mode-selector.tsx`
- [x] 4.2 Create `SplitBetween` component (`src/components/expense/split-between.tsx`):
  - Participant pills (reuse `ChipToggleGroup` style)
  - Group pills row with "New Group" primary pill
  - State: `selectedParticipantIds`, `selectedGroupIds`
- [x] 4.3 Create `GroupPill` component with tap → union selection, long-press → edit
- [x] 4.4 Create `GroupCreateModal` (`src/components/expense/group-create-modal.tsx`): name + people picker
- [x] 4.5 Wire `SplitBetween` into `ExpenseEditor`; remove old "Assign to group(s)" checkbox section

## 5. Editor UI: Progressive Weights

- [x] 5.1 Create `TotalSharesPanel` (`src/components/expense/total-shares-panel.tsx`):
  - Shows when `whatMode === 'even'`
  - One row per resolved participant: name, current share display, [Adjust] button
  - Live total validation bar
- [x] 5.2 Create `ShareEditor` modal (`src/components/expense/share-editor.tsx`):
  - Toggle: Equal / Percent / Amount
  - Percent: slider + input with live % remaining
  - Amount: dollar input with live $ remaining
  - Validation: prevent save if invalid
- [ ] 5.3 Add "Adjust shares" button to `LineItemRow` (when `whatMode === 'itemized'`)
- [ ] 5.4 Reuse `ShareEditor` for line-item shares (pass `lineItemId` context)
- [x] 5.6 Ensure default state: all participants selected, all shares equal

## 6. Event Page: Group Management

- [x] 6.1 Add inline group edit affordance to event page (`src/app/(app)/e/[token]/page.tsx`):
  - Group pills in a manageable list
  - Tap to edit members (reuse `GroupCreateModal`)
- [x] 6.2 Ensure groups created in editor appear on event page and vice versa
- [x] 6.3 Update the `ledgerExpenses` mapper in `src/app/(app)/e/[token]/page.tsx` to map `shares` (replacing the `groupIds` payload) and feed `computeParticipantBreakdown` the same share data

## 7. Receipt List & Display

- [x] 7.1 Update `ReceiptCard` in `src/components/event/receipt-list.tsx`:
  - Replace `MODE_LABELS` with new logic: show "By items" / "As a total" + share summary
  - For As a total: show "Equal" or "Custom" based on share types
- [x] 7.2 Update `MODE_LABELS` constant removal; use new display logic
- [ ] 7.3 Update the per-person balance breakdown surfaces (`src/components/event/balance-breakdown.tsx` and `balance-list.tsx`) for the new vocabulary: "By items" / "As a total" and custom share types (Equal % / $), consuming the same share data as the ledger

## 8. Scan Flow Integration

- [x] 8.1 Update `NewExpenseFlow` (`src/components/expense/new-expense-flow.tsx`):
  - Default to `whatMode: 'itemized'` after scan
  - Pre-select all participants in `SplitBetween`
  - Line items from scan have equal shares by default
- [x] 8.2 Verify scan → edit flow works with new UI

## 9. Edit Expense Page

- [x] 9.1 Update `src/app/(app)/e/[token]/expenses/[id]/edit/page.tsx`:
  - Load `expense_shares` and hydrate editor state
  - Reconstruct `selectedParticipantIds`/`selectedGroupIds` from shares
  - For group shares: select group pill; for explicit: select participant pill

## 10. TypeScript Types & Cleanup

- [x] 10.1 Update `EditorItem`, `ExpenseEditorProps` in `expense-editor.tsx` to use new types
- [x] 10.2 Remove `evenParticipantIds`, `groupIds` from all component props and state (schema columns removed separately in 1.6)
- [x] 10.3 Update `LedgerExpense` type in `ledger.ts` to include `shares` instead of old fields
- [x] 10.4 Remove `group` from `SplitMode` type; keep only `'itemized' | 'even'`
- [x] 10.5 Remove `even_participant_ids` / `group_ids` from the drizzle schema `expenses` relations and any queries/selects referencing them

## 11. Tests & Verification

- [x] 11.1 Add ledger tests for new weight types: percent, amount, mixed
- [x] 11.2 Add ledger tests for live group resolution (add/remove member → recompute)
- [x] 11.3 Add integration tests: create expense with custom shares, verify balances
- [x] 11.4 Add integration tests: group membership change updates past balances
- [x] 11.5 Run full test suite: `npm test` — all tests pass
- [x] 11.6 Run lint and typecheck: `npm run lint` — no errors
- [ ] 11.7 Add migration test: legacy `even` expense with participants stored in `group_ids` (pre-`0001`) migrates to equal `expense_shares`, and post-`0001` `even_participant_ids`-based expense migrates identically
- [x] 11.8 Add parity test: weighted-shares totals from `computeParticipantBreakdown` equal `computeConsumption`

## 12. Documentation & Polish

- [x] 12.1 Update any inline code comments referencing old split modes
- [x] 12.2 Verify marketing copy ("birthday") removed from components if any remain
- [ ] 12.3 Manual QA: create event, add expenses in both modes, verify settle-up
