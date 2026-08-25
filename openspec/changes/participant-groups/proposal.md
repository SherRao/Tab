## Why

Creating expenses within events becomes tedious when you need to repeatedly select the same subsets of participants. For group trips, weekends away, or any event with natural sub-groupings (e.g., two cars, dining tables), users should be able to define participant groups once and assign expenses to them. This avoids re-selecting individuals every time and makes the UI cleaner when expenses naturally align with existing group boundaries.

## What Changes

- **New capability: `groups`** — named collections of participants within an event, assignable to expenses
- **New capability: group-aware expense splitting** — when an expense has group(s) selected, the ledger computes balances using only the participants in those groups
- **Extended capability: `expenses`** — expenses can now optionally reference one or more groups instead of (or in addition to) individual participant selections
- **Extended capability: `balances`** — net balance derivation now supports group-participant resolution

### New Features

- **Group creation**: Event organizers can create named groups and assign participants to them
- **Group selection in expense entry**: When creating/editing an expense, users select group(s) instead of (or alongside) individual participant checkboxes
- **Group-aware ledger math**: `computeConsumption` resolves the participant set from selected groups before applying the split mode
- **Multiple groups per expense**: An expense can assign to multiple groups simultaneously; the participant sets are combined (union of all members)

### Split Mode Behavior with Groups

| Split Mode | Groups Selected    | Participants Used                                  |
| ---------- | ------------------ | -------------------------------------------------- |
| `itemized` | None               | All participants (existing behavior)               |
| `itemized` | One or more groups | Participants across selected groups                |
| `even`     | None               | All participants (existing behavior)               |
| `even`     | One or more groups | Participants across selected groups, split equally |
| `group`    | None               | All participants (existing "birthday mode")        |
| `group`    | One or more groups | Participants across selected groups, split equally |

### Non-Goals

- Group deletion (can be a future change)
- Group reordering/renaming UI (outside current scope)
- Per-user permissions or identity (linking users to participants is a future change)

## Capabilities

### New Capabilities

- `groups`: Creating groups within an event and assigning participants to them
- `expenses`: Group selection in expense entry; group-aware ledger computation
- `balances`: Net balance derivation using group-participant resolution

### Modified Capabilities

- `events`: No structural change; groups are event-scoped and exist alongside existing participants

### No Longer Needed (deferred)

(none)

## Impact

### Code Changes

- **`src/db/schema.ts`**: Add `groups` table, `participantGroup` junction table, `groupIds` column on `expenses`
- **`src/lib/ledger.ts`**: Modify `computeConsumption` to resolve participant IDs from selected groups
- **`src/components/expense-editor.tsx`**: Add groups checkbox UI alongside split mode and participant assignment
- **`src/lib/actions.ts`**: Update `ExpensePayload` to include optional `groupIds`; resolve participants from groups when saving

### Data Model Impact

| Table              | Change                                              |
| ------------------ | --------------------------------------------------- |
| `groups`           | New: `id`, `eventId`, `name`                        |
| `participantGroup` | New: `participantId`, `groupId` (composite PK)      |
| `expenses`         | Modified: adds `groupIds` (json array of group IDs) |

No existing tables are modified beyond the new columns/tables. Previous expenses without `groupIds` continue to work identically to before.

### UI Impact

- Expense editor gains a "Assign to group(s)" section with checkboxes for each group
- When a group is selected, the participant assignment UI can be simplified (groups' participants are implicitly the assignees)
- Split mode selection remains; group selection narrows the participant set

### Migration Plan

Initial schema migration adds the two new tables and the `groupIds` column. Existing expenses are unaffected (NULL `groupIds` = original behavior). No data migration required.

### Open Questions

- Should group membership be managed through a separate UI, or integrated into participant addition?
- Should the expense editor show which participants are in each group when the group is selected? (design decision for tasks.md)
