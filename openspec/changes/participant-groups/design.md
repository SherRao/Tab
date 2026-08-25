## Context

Greenfield change extending the existing expense-splitting app with participant groups. The proposal defines the "why" and "what"; this design covers the "how" — data model, ledger integration, and UI patterns.

### D1: Group Data Model

**New table: `groups`**

```
groups: { id, eventId, name }
```

- `id`: auto-increment primary key
- `eventId`: FK → events, onDelete cascade
- `name`: human-readable group name (e.g., "Car A", "Group 1")

**New table: `participantGroup`** (junction many-to-many)

```
participantGroup: { participantId, groupId }
```

- Composite PK: (participantId, groupId)
- `participantId`: FK → participants, onDelete cascade
- `groupId`: FK → groups, onDelete cascade

**Modified: `expenses`**

- Adds `groupIds: text` (JSON type, `number[]`) — stores which group(s) this expense is assigned to
- When `groupIds` is empty/absent, original behavior is unchanged (all participants, or `evenParticipantIds` for even mode)

### D2: Ledger Math Integration

`computeConsumption` in `src/lib/ledger.ts` is modified to resolve the participant set from groups:

```typescript
// At the start of each expense loop, resolve participantIds:
let participantIds = allIds;  // default: all participants in event

if (expense.groupIds && expense.groupIds.length > 0) {
  // Resolve: collect all participantIds from the selected groups
  // Query participantGroup table for each groupId
  // Result: unique set of participantIds across all selected groups
  participantIds = resolveGroupParticipants(expense.groupIds, participants);
}

// Then use participantIds instead of allIds/evenParticipantIds
// for all split mode logic (even, group, itemized)
```

**Key behaviors:**

- **No `groupIds`**: `participantIds` stays as `allIds` — existing behavior preserved
- **One `groupIds`**: `participantIds` = members of that group only
- **Multiple `groupIds`**: `participantIds` = union of members across all selected groups (deduped)
- `evenParticipantIds` is **ignored** when `groupIds` is set (design decision from exploration)

**Split mode interaction:**

| Mode | With groups | Without groups |
|---|---|---|
| `itemized` | Per-line assignments use `participantIds` from groups | Existing behavior |
| `even` | Total divided equally among `participantIds` | Uses `evenParticipantIds` or all participants |
| `group` | Everyone in `participantIds` splits total equally | "Birthday mode": all participants |

### D3: Expense Editor UI

Add groups selection alongside existing split mode radios:

```
How should this be split?
  [itemized]  [even]  [group]

Assign to group(s):  □ Group A (Alice, Bob)   □ Group B (Carol, Dave)
                       ▲ 4 participants selected
```

When a group is checked:
- The participant assignment area (line item toggles, even-mode checkboxes) can be
  hidden or disabled, since the group's members are the implicit assignees
- The UI can show a summary: "Selected groups: Group A + Group B (4 people total)"
- If no groups are selected, the existing participant UI behaves as before

### D4: Tax/Tip Allocation with Groups

Proportional allocation strategy stays the same, but uses the group-resolved participant set:
- `subtotal` per participant is computed based on their share across line items
- Tax/tip are allocated proportionally to each participant's subtotal **within the group**
- If multiple groups are selected, their participant sets are combined first, then allocation proceeds

### D5: Share Token & Access

No change — groups are event-scoped and accessible to anyone with the event share token,
consistent with v1's link-based authorization model.

### D6: Migration Plan

1. Create migration: `groups` table, `participantGroup` junction, `groupIds` column on `expenses`
2. Update `computeConsumption` in `ledger.ts` to resolve groups
3. Update expense-editor UI with groups selector
4. Update `saveExpenseAction` in `actions.ts` to persist `groupIds`
5. All existing expenses continue working (NULL `groupIds` = original behavior)

### Risks / Trade-offs

- **[Group deletion risk]** — deleting a group could leave expenses referencing a non-existent groupId; defer to future change or set groupIds to NULL on delete
- **[Rounding in proportional allocation]** — largest-remainder method used; same as existing, just with smaller participant set
- **[UI complexity]** — showing group membership summaries requires careful design; addressed in tasks.md