## 1. Schema Migration

- [ ] 1.1 Add `groups` table: `id`, `eventId`, `name`
- [ ] 1.2 Add `participantGroup` junction table: composite PK (`participantId`, `groupId`), FKs to `participants` and `groups`
- [ ] 1.3 Add `groupIds` column to `expenses` table (json, `number[]`, nullable, default `null`)

## 2. Ledger Math (group-aware consumption)

- [ ] 2.1 Modify `computeConsumption` in `src/lib/ledger.ts` to resolve participant IDs from selected groups before applying split mode
- [ ] 2.2 When `expense.groupIds` is set, collect all participant IDs from those groups (union, deduplicated)
- [ ] 2.3 When `expense.groupIds` is set, ignore `evenParticipantIds`; use group-resolved participant set
- [ ] 2.4 Ensure `evenParticipantIds` behavior is unchanged when `groupIds` is not set
- [ ] 2.5 Verify proportional tax/tip allocation uses the group-resolved participant set
- [ ] 2.6 Run existing test suite; all 38 tests must still pass

## 3. Expense Editor UI

- [ ] 3.1 Add "Assign to group(s)" section with checkboxes for each event's groups
- [ ] 3.2 When a group is checked, its participants are implicitly the assignees; UI can show a summary
- [ ] 3.3 When no groups are checked, existing participant UI behaves as before (itemized toggles, even-mode checkboxes)
- [ ] 3.4 Show which participants are in each selected group (summary area)
- [ ] 3.5 Update save payload to include `groupIds` array

## 4. Actions (save/update expense)

- [ ] 4.1 Update `ExpensePayload` in `src/lib/actions.ts` to include optional `groupIds?: number[]`
- [ ] 4.2 When saving, resolve participant IDs from selected groups and store `groupIds` in the expenses table
- [ ] 4.3 When updating an expense, preserve or replace `groupIds` based on form state
- [ ] 4.4 Run existing test suite; all 38 tests must still pass

## 5. Balances UI

- [ ] 5.1 Render net balances on the event page, reflecting group-scoped expenses
- [ ] 5.2 When group expenses exist, balances should only include participants from those groups
- [ ] 5.3 Run existing test suite; all 38 tests must still pass

## 6. Full Test Suite

- [ ] 6.1 Run `npm test`; verify all tests pass (including any new group-specific tests)
- [ ] 6.2 Verify edge cases: empty groups, single group, multiple groups, groups with overlapping membership
- [ ] 6.3 Lint and typecheck: `npm run lint` and typecheck must pass
