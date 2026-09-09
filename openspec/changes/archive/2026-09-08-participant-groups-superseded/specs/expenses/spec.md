## Purpose

Expenses can be assigned to one or more participant groups. When groups are selected, the ledger resolves the participant set from group membership and applies the split mode within that set.

## ADDED Requirements

### Requirement: Group assignment on expense creation

The system SHALL store which group(s) an expense is assigned to, and use that selection to resolve participants for balance computation.

#### Scenario: Save expense with group selection

- **WHEN** a link holder submits an expense form with one or more group checkboxes checked
- **THEN** the expense is saved with `groupIds` set to the selected group IDs, and the ledger uses only those groups' participants for balance computation

#### Scenario: GroupIds stored in database

- **WHEN** an expense is saved with group selection
- **THEN** the `expenses` table's `groupIds` column contains a JSON array of the selected group IDs

#### Scenario: Expense without group selection

- **WHEN** a link holder saves an expense without checking any group checkboxes
- **THEN** `groupIds` is stored as `null` or `[]`, and the ledger uses original behavior (all participants or `evenParticipantIds`)

### Requirement: Group-aware ledger computation

The system SHALL resolve participant IDs from selected groups before applying split mode logic.

#### Scenario: Even split within group

- **WHEN** an expense has `groupIds: [Group A]` (3 members), `splitMode: "even"`, total $30
- **THEN** each of the 3 group members owes $10; other participants in the event have $0 net for this expense

#### Scenario: Even split across multiple groups

- **WHEN** an expense has `groupIds: [Group A, Group B]` (2 + 3 = 5 unique members), total $50
- **THEN** each of the 5 members owes $10; computation uses union of participants, no duplicates

#### Scenario: Itemized within groups

- **WHEN** an expense has groups selected, split mode is `itemized`, and line items have participant assignments
- **THEN** each line item's `participantIds` are filtered to only include participants from the selected groups; tax/tip allocation uses the group-resolved participant set

#### Scenario: Group mode within groups

- **WHEN** an expense has `groupIds: [Group A]` and `splitMode: "group"`
- **THEN** all members of Group A split the total equally, ignoring any per-item assignments (same semantics as existing "group"/birthday mode, but scoped to the group)
