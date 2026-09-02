## Why

The current expense-split UX presents three modes (`itemized`, `even`, `group`) that overlap confusingly: `even` and `group` perform identical math (equal split among selected people), `groupIds` is misused as participant IDs instead of real group IDs, and two competing "who" pickers exist and both persist (chips → `evenParticipantIds`, checkboxes → `groupIds`). The "birthday mode" label is a placeholder for "everyone selected." Users cannot adjust weights (percentages or exact amounts) on totals or line items.

## What Changes

- **Remove the third split mode**: `group` is dropped; "Everyone Equally" becomes a state of "As a total + all people + equal"
- **Unified weight system**: New `expense_shares` table stores weights (`equal` | `percent` | `amount`) per participant per line item OR per whole expense
- **Two WHAT modes**: **By items** (receipt-style, per-line weights) and **As a total** (lump sum, total-level weights)
- **Groups as live shortcuts**: Event-scoped groups persist in `groups`/`participantGroup`; selecting a group unions its current members. Editing group membership later updates past balances (live link)
- **Progressive disclosure**: Equal by default; `%` / `$` appear on demand per person or per line item
- **Inline group creation**: "New Group" pill in the split-between row opens a modal; no separate management screen

**BREAKING**: `splitMode` enum drops `group`; the `even_participant_ids` and `group_ids` columns on `expenses` are dropped (replaced by `expense_shares`); expense API stores shares instead of mode-specific fields

## Capabilities

### New Capabilities
- `expense/weighted-shares`: Unified weight storage and computation for both line-item and whole-expense splits (replaces `evenParticipantIds` and `group` mode logic)
- `expense/groups`: Event-scoped participant groups with live-link resolution at balance compute time

### Modified Capabilities
- `expenses`: Split mode reduced to two values (`itemized`, `even`); share weights drive all division logic; tax/tip allocation uses resolved participant set from shares
- `balances`: Net balance derivation now uses `expense_shares` with live group resolution

## Impact

### Code Changes
- `src/db/schema.ts`: Add `expense_shares` table; drop `group` from `SPLIT_MODES`; drop the `even_participant_ids` and `group_ids` columns from `expenses` (both added since `0001_redundant_nemesis`)
- `src/lib/ledger.ts`: Rewrite `computeConsumption` and `computeParticipantBreakdown` to read from `expense_shares` and resolve live group members; extract shared resolution/weight logic so the two never drift apart
- `src/lib/actions.ts`: Update `ExpensePayload` to include `shares` array; persist shares on save/update
- `src/lib/queries.ts`: Fetch `expense_shares` alongside expenses
- `src/components/expense/expense-editor.tsx`: Replace split mode tiles + dual who-pickers (`evenParticipantIds` chips and `groupIds` checkboxes) with unified editor
- `src/components/expense/split-mode-selector.tsx`: Replace with two-tile WHAT selector
- `src/components/expense/line-item-row.tsx`: Add "adjust shares" affordance
- `src/components/ui/chip-toggle-group.tsx`: Extend for group pills in second row
- `src/app/(app)/e/[token]/page.tsx`: Map `shares` into ledger expenses/breakdowns; inline group create/edit affordance
- `src/components/event/receipt-list.tsx` + `src/components/event/balance-breakdown.tsx`: Replace `MODE_LABELS`/split copy with "By items"/"As a total" + share-type display

### Data Migration
- Existing `even`/`group` expenses → insert `expense_shares` rows with `equal` weight for all resolved participants
- Existing `itemized` expenses → insert `expense_shares` per line item from `line_item_shares`
- `even` expenses created after `0001_redundant_nemesis` store chosen people in `evenParticipantIds`; earlier `even` expenses stored them in `groupIds`. Resolve as `evenParticipantIds ?? groupIds` before migrating

### Tests
- All 38 existing ledger/integration tests must pass after migration
- New tests for: weighted shares (%, $), live group resolution, progressive disclosure UI
