## Context

Current state (see proposal.md - Why):
- Three split modes (`itemized`, `even`, `group`) where `even` and `group` do identical math
- `groupIds` column misused as participant IDs; real `groups`/`participantGroup` tables exist but unused
- Two competing "who" pickers in editor (Split between / Assign to groups), both persisted: chips → `evenParticipantIds` (column added by `0001_redundant_nemesis`), checkboxes → `groupIds`
- `expenses.even_participant_ids` / `expenses.group_ids` both store participant IDs; pre-`0001_redundant_nemesis` `even` expenses stored chosen people in `group_ids`
- No weight customization (% or $) on totals or line items
- Ledger (`computeConsumption`) reads from `evenParticipantIds` and `groupIds` directly, and `computeParticipantBreakdown` duplicates the same resolution/split logic (incl. the `even ? participantIds : participantIds` no-op at ledger.ts:105 / 226)`

Constraints:
- SQLite via better-sqlite3, WAL mode
- Money always integer cents end-to-end
- Server components by default; client only where state needed
- Link-based auth (no user sessions)
- Existing 38 tests must pass after migration

## Goals / Non-Goals

**Goals:**
- Single source of truth for split weights: `expense_shares` table
- Two clear WHAT modes: By items / As a total
- Groups as live shortcuts (event-scoped, inline creation)
- Progressive disclosure: equal by default, weights on demand
- All existing tests pass; new behavior covered by tests

**Non-Goals:**
- Group deletion (defer)
- Group reordering/renaming UI beyond inline edit
- Per-user permissions or identity linking
- Named Simple/Advanced modes
- Receipt OCR changes

## Decisions

### D1: `expense_shares` table schema

```sql
expense_shares:
  id INTEGER PRIMARY KEY AUTOINCREMENT
  expenseId INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE
  participantId INTEGER REFERENCES participants(id) ON DELETE CASCADE
  groupId INTEGER REFERENCES groups(id) ON DELETE SET NULL
  lineItemId INTEGER REFERENCES line_items(id) ON DELETE CASCADE
  weightType TEXT NOT NULL CHECK (weightType IN ('equal','percent','amount'))
  weightValue INTEGER NOT NULL  -- basis points for percent, cents for amount, 10000 for equal
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
```

**Rationale:**
- `lineItemId = NULL` → expense-total shares ("As a total")
- `lineItemId` set → line-item shares ("By items")
- `groupId` non-NULL + `participantId` NULL → live group reference
- `participantId` non-NULL + `groupId` NULL → explicit participant
- `weightValue` as integer: basis points (0-10000) for %, cents for $, 10000 for equal
- Composite unique index on `(expenseId, lineItemId, participantId, groupId)` prevents duplicates

**Alternatives considered:**
- Separate tables for total shares vs line shares → more complex queries, harder to unify
- Store weights as JSON on expense → loses relational integrity, harder to query
- Float weights → money precision issues (avoided by using integer basis points/cents)

### D2: Ledger computation (`computeConsumption` / `computeParticipantBreakdown`)

Algorithm:
1. For each expense, collect all `expense_shares` rows
2. Partition by `lineItemId` (NULL = total level)
3. For each partition:
   a. Resolve participant set:
      - Explicit participants: `participantId` rows
      - Group participants: for each `groupId`, query current `participantGroup` members
      - Union + dedupe
   b. Build weight array per participant:
      - `equal`: weight = 1 (normalized later)
      - `percent`: weight = `weightValue` / 10000
      - `amount`: handled specially (exact cents, not proportional)
   c. If any `amount` shares exist:
      - Assign exact `weightValue` cents to those participants
      - Remaining total → distribute proportionally among `equal`/`percent` participants
   d. Else: distribute total proportionally by weights (largest-remainder)
4. Tax/tip: allocate proportionally to pre-tax subtotals (unchanged logic)

**Rationale:** Single code path handles all weight types and both WHAT modes. Live group resolution happens at step 3a.

**Shared resolution helper:** `computeParticipantBreakdown` (drives the per-person balance breakdown UI, ledger.ts:197) currently re-implements the same participant-set resolution and split math as `computeConsumption`. Factor resolution + share application into one helper and drive both functions from it, so breakdown totals always reconcile with `computeConsumption` (commit `4d1c62f` established that parity requirement for the old model; the weight refactor must not regress it).

**Alternatives considered:**
- Resolve groups at save time (snapshot) → loses live-link requirement
- Pre-compute and store resolved participants on expense → denormalization, sync complexity

### D3: Expense editor UI architecture

Component structure:
```
ExpenseEditor (client)
├── WhatModeSelector (client)          -- By items / As a total tiles
├── SplitBetween (client)              -- WHO pills + group pills
│   ├── ParticipantPill (client)       -- person chip toggle
│   └── GroupPill (client)             -- group chip toggle + "New Group"
├── TotalSharesPanel (client)          -- shows when As a total
│   ├── ShareRow (client)              -- per person: label, %, $, [adjust]
│   └── ShareEditor (client)           -- modal: % / $ input with live total
├── LineItemList (client)              -- shows when By items
│   └── LineItemRow (client)           -- existing + [adjust shares] button
└── GroupCreateModal (client)          -- name + people picker
```

**State management:**
- `whatMode`: 'itemized' | 'even'
- `selectedParticipantIds`: Set<number> (explicit picks)
- `selectedGroupIds`: Set<number> (group pills)
- `shares`: Map<string, ShareConfig> keyed by `"${lineItemId}|${participantId}"` or `"total|${participantId}"`

**Resolved participant set** = `selectedParticipantIds ∪ members(selectedGroupIds)` (deduped)

**Defaults:** All event participants selected; shares = equal

**Rationale:** Single state tree, progressive disclosure via conditional rendering. No separate Simple/Advanced modes.

### D4: Group creation inline

"New Group" pill opens a modal with:
- Name input (required)
- People picker: checkboxes for all event participants
- Save → inserts into `groups` + `participantGroup` → closes modal → new group pill appears

Edit group: long-press or context menu on group pill → same modal pre-filled.

**Rationale:** Keeps group management in context where it's used. No separate settings page.

### D5: Share editor UX (progressive disclosure)

For each participant in TotalSharesPanel:
- Default display: "Alice · Equal · $20.28"
- Tap "Adjust" → inline editor or modal:
  - Toggle: Equal / Percent / Amount
  - Percent: slider or input (0-100), live total shows remaining %
  - Amount: dollar input, live total shows remaining $
  - Validation: % must sum to 100; $ must sum to total
- Last participant auto-fills remainder (absorbs rounding cent)

Line items: "Adjust shares" button on LineItemRow opens same editor for that line's participants.

**Rationale:** Weights hidden until needed. Validation prevents impossible states.

### D6: Migration strategy

1. **Schema**: Add `expense_shares` table; add `groups`/`participantGroup` if not exist
2. **Data migration** (single script, run once):
   - For each expense:
     - If `splitMode = 'group'`: resolved set = all event participants
     - If `splitMode = 'even'`: resolved set = `evenParticipantIds ?? groupIds` (post-`0001` field, falling back to legacy `group_ids` storage), else all participants
     - For `even`/`group`: insert `expense_shares` with `lineItemId = NULL`, `weightType = 'equal'`, `weightValue = 10000` for each resolved participant
     - If `splitMode = 'itemized'`: for each line item, insert `expense_shares` with `lineItemId = item.id`, `weightType = 'equal'` for each `line_item_shares` participant
3. **Code switch**: Update `computeConsumption` / `computeParticipantBreakdown` (via shared helper) to read from `expense_shares`; keep fallback for expenses without shares (should be none after migration)
4. **Cleanup**: Drop the `even_participant_ids` and `group_ids` columns from `expenses` and their types/payloads; drop `group` from `SPLIT_MODES` enum
5. **Verify**: Run full test suite

**Rollback**: Keep old columns until migration verified; can revert `computeConsumption` to old logic.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| [Weight validation edge cases] % sums to 99.99% due to rounding | Accept 1 basis point tolerance; auto-adjust last participant |
| [Amount shares + tax/tip] exact amounts may not leave room for proportional tax | Validate at save: sum(amounts) ≤ totalCents - taxCents - tipCents |
| [Live group resolution performance] | Groups per event small (<20); query `participantGroup` once per expense group, cache per request |
| [Migration data loss] | Run migration in transaction; verify row counts before dropping old columns |
| [Breakdown drift] `computeParticipantBreakdown` totals must match `computeConsumption` after the weight refactor | Shared resolution helper + parity test (precedent: `4d1c62f` reconciled them for the old model) |
| [UX complexity] Weights on both modes | Progressive disclosure hides weights by default; user testing before ship |

## Open Questions

1. **Share editor modal vs inline**: Modal simpler for mobile; inline better for desktop. Decide during implementation.
2. **Group pill display**: Show member count? Show member avatars on hover? Start with count only.
3. **Amount shares on line items**: Spec allows it; UI may defer to post-MVP if complexity high.
4. **Rounding strategy for mixed weights**: Largest-remainder on proportional portion; exact amounts fixed. Confirm acceptable.
