> **Audited 2026-09-08.** Many boxes below were ticked without the work being
> done, or were done under a different name. Every item has been re-verified
> against the code and re-marked. Where the shipped name differs from the task
> text, the task now names what actually exists. Two money-affecting defects
> found during the audit are tracked in section 13.
>
> The `participant-groups` change was archived as superseded on the same date;
> the groups work it described now lives in sections 4 and 6 here.

## 1. Schema & Migration

- [x] 1.1 Add `expense_shares` table to `src/db/schema.ts:205` with indexes and relations (`:300`); migration `drizzle/0002_living_shinobi_shaw.sql`
- [x] 1.2 `groups` (`schema.ts:56`) and `participantGroup` (`schema.ts:92`) exist, both in `drizzle/0000_abnormal_ronan.sql`
- [x] 1.3 Write `src/scripts/migrate-shares.ts` handling `even_participant_ids` (`:85`), legacy `group_ids` (`:93`), all-participants fallback (`:101`), `group` mode (`:78`), and itemized from `line_item_shares` (`:108`)
- [x] 1.4 Applied to `data/app.db` (148 share rows across 10 expenses; backup at `data/app.db.bak.20260904_123326`)
- [x] 1.5 `SPLIT_MODES = ["itemized", "even"]` (`schema.ts:151`); `splitMode` defaults to `itemized` (`:168`)
- [x] 1.6 `even_participant_ids` and `group_ids` dropped in `drizzle/0003_tricky_satana.sql`; absent from schema and the live DB
- [ ] 1.7 **NEW —** `migrate-shares.ts` is now inoperable: 1.6 dropped the very columns it reads at `:29-31`, so every `even` expense silently falls through to the all-participants branch. It is also not idempotent (SQLite treats NULLs as distinct in `expense_shares_unique_idx`, so a re-run duplicates every total-level row). Either delete the script now that `data/app.db` is migrated, or gate it on the columns still existing and make it idempotent

## 2. Ledger Math

- [x] 2.1 `computeConsumption` (`ledger.ts:158`) reads `expense.shares` (`:174`); no `evenParticipantIds`/`groupId` fields remain
- [x] 2.2 Participant resolution — union of explicit `participantId` rows and live `groupId` lookup (`ledger.ts:91-109`)
- [x] 2.3 Weight computation per scope: `equal` → 1, `percent` → `/10000`, `amount` → exact cents (`ledger.ts:102-107`)
- [x] 2.4 Mixed weight types: exact amounts first, remainder proportional (`ledger.ts:120-139`)
- [x] 2.5 Tax/tip proportional allocation from share-derived pre-tax subtotals (`ledger.ts:206-244`, itemized only — `even` splits the whole total, which is correct but differs from the task text)
- [x] 2.6 No-shares fallback (`ledger.ts:246`, mirrored at `:468`)
- [x] 2.7 `npm test` passes (57 tests, up from 38)
- [x] 2.8 `resolveShares` (`ledger.ts:81`) is genuinely shared by `computeConsumption` (`:181`, `:215`) and `computeParticipantBreakdown` (`:367`, `:430`)
- [x] 2.9 Breakdown uses the shared helper; parity tests at `ledger.test.ts:420`
- [x] 2.10 `getGroupMemberLookup` (`queries.ts`) now feeds both `computeNetBalances` and `computeParticipantBreakdown` on the event page, so `groupId` shares resolve to live membership. Integration-tested in `groups-flow.integration.test.ts`
- [ ] 2.11 **NEW —** Only the *inner* duplication was removed in 2.8. `computeParticipantBreakdown:359-536` still re-implements the even/itemized branching, the no-shares fallback, and tax/tip allocation using a different algorithm (`Math.round(ratio * extra)` at `:459`, `:383`) than `computeConsumption` (`allocateByWeights` at `:234`). The two paths can disagree by a cent — extract the extras allocation too
- [x] 2.12 **NEW —** `resolveShares` treated equal weights as additive, so a participant in two overlapping selected groups (or picked explicitly *and* via a group) was double-charged. Equal weight is now presence-based (a `Set`), matching the spec's "group members union". Covered by the overlap test in `groups-flow.integration.test.ts`

## 3. Actions & Queries

- [x] 3.1 `ExpensePayload` carries `shares[]` (`actions.ts:142-157`)
- [x] 3.2 `saveExpenseAction` inserts `expense_shares` (`actions.ts:196`)
- [x] 3.3 `updateExpenseAction` replaces them (`actions.ts:274`)
- [x] 3.4 Percent-sums-to-10000 / amount-sums-to-total validation exists (`actions.ts:167-180`, duplicated at `:246-259`)
- [x] 3.5 `getExpenses` fetches shares (`queries.ts:126`), returned on `ExpenseWithItems.shares`
- [x] 3.6 Integration tests pass
- [ ] 3.7 **NEW (partly addressed) —** 13.1 corrected the *classification* so item-scoped shares are no longer mistaken for total-level ones (`actions.ts:172`, `:253`). Two holes remain: line-item-level percent/amount shares are still never validated (note that a strict per-item sum would wrongly reject legitimate rounding like 3333×3, so this needs normalization, not a bare equality check), and percent/amount are still checked independently, so a mixed set demands the percents alone reach 10000 — contradicting `resolveShares` (`ledger.ts:120-139`). De-duplicate the two copies while fixing

## 4. Editor UI: Split between + groups

- [x] 4.1 "By items" / "As a total" tiles — shipped as `SplitModeSelector` (`split-mode-selector.tsx:10`), not the `WhatModeSelector` name in the original task
- [x] 4.2 Participant pills — shipped as an inline `ChipToggleGroup` section in `expense-editor.tsx:252`, not as a separate `split-between.tsx`
- [x] 4.3 `GroupPillRow` (`group-pill-row.tsx`) renders the group pills + "New group" pill in the editor's Split-between row; the editor holds `selectedGroupIds` state
- [x] 4.4 Each pill shows `Name (count)`; tap toggles the group into the split (union at compute time). **Deviation:** edit is a visible ✎ affordance on the pill, not long-press — long-press isn't accessible on desktop/keyboard
- [x] 4.5 `GroupCreateModal` is now wired from both the editor and the event page; extended with an error line and an optional Delete affordance
- [x] 4.6 Group data layer landed: `getGroupsForEvent` / `getGroupMemberLookup` (`queries.ts`) and `createGroupAction` / `updateGroupAction` (`actions.ts`), gated by session + share token, validating name, non-empty membership, and event ownership of the group. `deleteGroupAction` now lands too, with an in-use guard: it refuses to delete a group any receipt still splits by (`expenseShares.groupId` is `set null` on delete, which would otherwise silently drop those shares)
- [x] 4.7 `buildShares` emits an equal `groupId` share per selected group, plus explicit `participantId` shares only for people outside every selected group (no double-count). Per the product decision, selecting a group forces an equal split; custom %/$ is available only when no group is selected

## 5. Editor UI: Progressive Weights

- [x] 5.1 `TotalSharesPanel` (`total-shares-panel.tsx:23`), wired at `expense-editor.tsx:276`, shown when `splitMode === "even"`
- [x] 5.2 Share editor modal — shipped as an internal `ShareEditorModal` inside `total-shares-panel.tsx:94`, not as `share-editor.tsx`. Equal/Percent/Amount toggle (`:147`), live remaining (`:163`, `:184`), save gated on validity (`:199`)
- [ ] 5.3 Add "Adjust shares" to `LineItemRow` — still absent; `line-item-row.tsx` has only assignee chips (`:75`) and the integer quantity splitter (`:91`), and `EditorItem` (`:6-12`) carries no share state
- [ ] 5.4 Make the share editor reusable per line item — currently impossible: `ShareEditorModal` is not exported, and `ShareConfig` (`total-shares-panel.tsx:10`) has no `lineItemId` field
- [x] 5.6 Default state: all participants selected, all shares equal (`expense-editor.tsx:57-71`), re-synced on toggle (`:261`)
- [ ] 5.7 **NEW —** `TotalSharesPanel` has no live aggregate validation bar (5.1 called for one). Over/under is only surfaced inside the modal (`:119-125`), so the panel can show an invalid set with no warning
- [ ] 5.8 **NEW (optional) —** percent entry is a plain number input; the original task specified a slider alongside it

## 6. Event Page: Group Management

- [x] 6.1 A Groups section on the event page (`GroupManager`) lists groups with members, opens the shared modal to rename / change members / delete, and has a "New group" pill
- [x] 6.2 Groups created in the editor appear on the event page and vice versa: both call the same actions, whose `revalidatePath` plus a `router.refresh()` resync the other surface
- [x] 6.3 The `ledgerExpenses` mapper passes `shares` (including `groupId`) to both `computeNetBalances` and `computeParticipantBreakdown` (`page.tsx:70-90`, `:121-148`)
- [x] 6.4 The event page builds `getGroupMemberLookup(event.id)` from `participantGroup` and passes it to both ledger calls, so 6.3's `groupId` plumbing now resolves

## 7. Receipt List & Display

- [x] 7.1 `getModeLabel` in `receipt-list.tsx:34` returns "By items" / "As a total · Equal" / "As a total · Custom"; rendered at `:95`
- [x] 7.2 `MODE_LABELS` removed — zero references remain in `src/`
- [x] 7.3 (mostly) Each receipt group in the breakdown now shows a `splitLabel` — "By items" / "As a total · Equal|Custom" — derived in `computeParticipantBreakdown` and surfaced in `balance-breakdown.tsx`. **Still open:** per-person, per-share Equal/%/$ badges (needs each participant's weight type threaded through the breakdown item). `balance-list.tsx` left as-is: its rows are net positions, not per-split, so split vocabulary doesn't belong there

## 8. Scan Flow Integration

- [x] 8.1a Default to `itemized` after scan (`new-expense-flow.tsx:38`, `:64`)
- [x] 8.1b Pre-select all participants (`new-expense-flow.tsx:39`, `:65`), consumed by the editor's chip section
- [ ] 8.1c **NOT DONE (was wrongly ticked)** — scanned line items are created with `participantIds: []` (`new-expense-flow.tsx:53`), so every scanned item is unassigned and trips the "no assignees yet" warning (`expense-editor.tsx:303`). They should default to all participants, equally
- [x] 8.2 Scan → edit shape covered by `receipt-editor-flow.test.ts:10`. Note it builds its own `toEditorInitial` rather than exercising `NewExpenseFlow.applyDraft`, and asserts nothing about shares

## 9. Edit Expense Page

- [x] 9.1a `selectedParticipantIds` reconstructed from total-level shares (`edit/page.tsx:21-24`)
- [x] 9.1b Group selections are reconstructed on edit via `hydrateSelectedGroupIds`, fed to the editor's new `initial.selectedGroupIds`. Round-trip covered in `groups-flow.integration.test.ts`
- [x] 9.1c Weight types and values are now hydrated for whole-expense splits via `hydrateTotalShares` (see 13.2). Itemized per-unit weights remain lossy — see 9.1d
- [ ] 9.1d **NEW —** line-item assignees are hydrated from the legacy `line_item_shares` table (`edit/page.tsx:43`, `queries.ts:141`) rather than from `expense_shares`, and per-unit quantities are not persisted at all, so editing an itemized expense silently flattens it to an equal item split. Reconcile once 5.3/5.4 land

## 10. TypeScript Types & Cleanup

- [x] 10.1 `EditorItem` / `ExpenseEditorProps` updated (`line-item-row.tsx:6`, `expense-editor.tsx:21`)
- [x] 10.2 `evenParticipantIds` / `groupIds` gone from all components, app, and lib — only `migrate-shares.ts` still reads them, deliberately
- [x] 10.3 `LedgerExpense` carries `shares` (`ledger.ts:15-31`)
- [x] 10.4 `group` removed from `SplitMode` (`ledger.ts:13`, `schema.ts:151`)
- [x] 10.5 Old columns gone from the drizzle schema and all queries/selects

## 11. Tests & Verification

- [x] 11.1 Percent (`ledger.test.ts:179`), amount (`:202`), mixed (`:280`)
- [x] 11.2 Live group resolution (`ledger.test.ts:341`)
- [x] 11.3 Integration: custom percent shares round-trip through `saveExpenseAction` (`flow.integration.test.ts:209`) plus percent validation (`:236`). Only percent is covered — no integration coverage for `amount` or mixed
- [x] 11.4 `groups-flow.integration.test.ts` drives the real actions and `participantGroup` table: create + resolve, live add, live remove, and the validation guards. This is the integration coverage that 2.10/6.4 lacked
- [x] 11.5 `npm test` — 57 passing
- [x] 11.6 `npm run lint` — 0 errors (one pre-existing unrelated warning in `commitlint.config.mjs`)
- [ ] 11.7 Migration test for legacy `even` expenses — nothing imports or exercises `migrate-shares.ts`; its legacy `group_ids` branch (`:93-100`) has never been executed. See 1.7: decide the script's fate first
- [x] 11.8 Parity tests (`ledger.test.ts:420`). Note they compare `totalConsumedCents`, which the breakdown copies straight from `computeConsumption` (`ledger.ts:348`), so the assertion is partly tautological and does not cross-check the duplicated tax/tip math in 2.11
- [x] 11.9 Regression tests added ahead of the fixes: `flow.integration.test.ts` (quantity weights survive, multi-item weighted saves are accepted, total-level validation still bites, custom split survives an edit, equal-share/legacy equivalence) and `expense-hydrate.test.ts`. Suite is 65 passing, up from 57

## 12. Documentation & Polish

- [x] 12.1 No stale split-mode comments remain in `src/lib`, `src/components`, or `src/app`
- [x] 12.2 The "birthday mode" split-mode label is gone. The remaining "birthday"/"birthdays" strings (`create-tab-form.tsx:67`, `marketing/how-it-works.tsx:5`) are event-type examples in marketing copy, unrelated to the split mode — intentionally kept
- [ ] 12.3 Manual QA: create event, add expenses in both modes, create/use/edit a group, verify settle-up. 13.1/13.2 are fixed; the group UI compiles, type-checks, and has integration coverage but has **not been visually QA'd in a browser**
- [x] 12.4 The stale "will be set by the action" comment is gone — `buildShares` was rewritten as part of 13.1

## 13. Defects found during the audit

- [x] 13.1 **FIXED — Itemized quantity splits silently zeroed out the whole expense.** `buildShares()` emits itemized per-item weights with `lineItemId: null` and a comment saying the action will set it (`expense-editor.tsx:130-136`), but neither `saveExpenseAction` (`actions.ts:196-224`) nor `updateExpenseAction` (`:274-313`) ever backfills it — both insert shares *before* the line items exist. The ledger's itemized branch then filters on `lineItemId != null` (`ledger.ts:192`), finds nothing, and drops all line-item consumption; only tax/tip get an equal-split fallback.
  - Reproduced: one $30 item, Alice 2 units / Bob 1, no tax. Quantities blank → Alice +$15.00 / Bob −$15.00 (correct). Quantities entered → **Alice +$30.00 / Bob $0.00** — Bob owes nothing.
  - Only triggers when the quantity splitter is used; with quantities blank, `buildShares()` returns `[]` and the no-shares fallback produces the right answer, which is why the suite is green.
  - Fixed by scoping item-level weights with an `itemIndex` into `payload.items` (`actions.ts:154`), inserting line items *before* shares, and resolving the index to the new `lineItemId` in a shared `insertExpenseShares` helper used by both actions. `buildShares` now also emits equal weights for items with no usable quantities, so no item is left without shares — `flow.integration.test.ts` proves the result matches the legacy fallback exactly, tax and tip included.
  - The validator also had to stop treating item-scoped shares as total-level (`actions.ts:172`, `:253`); before, a second weighted item pushed the percent sum past 100% and the save threw outright.
- [x] 13.2 **FIXED (whole-expense splits) — Editing an expense silently reset custom shares to equal.** The edit page passes no weight data (`edit/page.tsx:40-55`) and the editor rebuilds every share as `equal`/10000 (`expense-editor.tsx:60-71`). Because `updateExpenseAction` deletes and re-inserts all rows (`actions.ts:274-286`), opening an expense with custom percent/amount shares and saving any unrelated field — even just the description — destroys the split.
  - Fixed with `hydrateTotalShares` (`src/lib/expense-hydrate.ts`), which the edit page now feeds into a new `initial.shares` prop; the editor seeds its share state from it instead of rebuilding everything as equal.
  - **Still open:** this covers whole-expense (`even`) weights only. Itemized per-unit quantities are still not recoverable on edit — they are stored as derived percents, and quantity is not persisted, so reopening an itemized expense and saving falls back to an equal item split. Tracked in 9.1d; a full fix needs the per-item share state from 5.3/5.4.
  - **Not covered by tests:** the editor's `useState` seeding is React state with no component test around it. `hydrateTotalShares` is unit-tested (`expense-hydrate.test.ts`) and the action round-trip is integration-tested; the wiring between them was verified by reading.
