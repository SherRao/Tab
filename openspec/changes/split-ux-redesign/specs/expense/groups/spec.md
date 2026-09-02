## Purpose

Event-scoped participant groups that act as live shortcuts in the split UI. Groups persist on the event, can be created inline, and resolve to current membership at balance-compute time (live link).

## ADDED Requirements

### Requirement: Group creation and membership

The system SHALL allow creating named groups within an event and assigning participants to them.

#### Scenario: Create group from split UI

- **WHEN** a user taps "New Group" in the split-between row and enters name "Car A" with Alice and Bob
- **THEN** a row is inserted into `groups` and `participantGroup` with Alice and Bob as members

#### Scenario: Group persists on event

- **WHEN** a group is created
- **THEN** it appears in the group-pill row for all future expenses in that event

#### Scenario: Edit group membership

- **WHEN** a user edits a group's members
- **THEN** `participantGroup` rows are updated to reflect the new membership

### Requirement: Group resolution at compute time (live link)

The system SHALL resolve group membership at balance-compute time, not at save time.

#### Scenario: Past expense reflects new group member

- **WHEN** an expense was saved with group "Car A" (Alice, Bob)
- **AND** later Carol is added to "Car A"
- **THEN** recomputing balances includes Carol in that expense's participant set

#### Scenario: Past expense reflects removed group member

- **WHEN** an expense was saved with group "Car A" (Alice, Bob, Carol)
- **AND** later Carol is removed from "Car A"
- **THEN** recomputing balances excludes Carol from that expense's participant set

#### Scenario: Multiple groups union their members

- **WHEN** an expense has `groupIds: [Group A, Group B]` with overlapping membership
- **THEN** the resolved participant set is the union (deduplicated) of both groups' current members

### Requirement: Group selection in expense editor

The system SHALL display group pills in the split-between row and allow selecting them.

#### Scenario: Tap group pill unions current selection

- **WHEN** user taps "Car A" pill while Alice is already selected
- **THEN** Alice remains selected and Bob is added (union behavior)

#### Scenario: Group pill shows member count

- **WHEN** group "Car A" has 2 members
- **THEN** the pill displays "Car A (2)" or similar indicator

#### Scenario: Explicit participant + group selection

- **WHEN** user selects Alice explicitly and also taps "Car A" (which includes Bob)
- **THEN** the resolved set is Alice + Bob (no duplicates)

### Requirement: Group ID stored on expense shares

The system SHALL store group references on `expense_shares` to enable live resolution.

#### Scenario: Shares row references group instead of participant

- **WHEN** user selects group "Car A" for an "As a total" expense
- **THEN** `expense_shares` row has `groupId = Car A ID`, `participantId = NULL`, `weightType = 'equal'`

#### Scenario: Explicit participant shares have no groupId

- **WHEN** user selects Alice explicitly (not via group)
- **THEN** `expense_shares` row has `participantId = Alice ID`, `groupId = NULL`