## Purpose

Lets event organizers create named groups of participants and assign expenses to those groups. The group is the only access mechanism: anyone with the event link can view and manage groups and group-assigned expenses.

## ADDED Requirements

### Requirement: Group creation

The system SHALL allow an event organizer to create a named group and assign participants to it.

#### Scenario: Create a group

- **WHEN** a link holder submits a group name and selects one or more participants
- **THEN** the system creates the group, stores the participant assignments, and makes the group available for expense selection

#### Scenario: Reject empty group

- **WHEN** a link holder submits a group name with zero participants
- **THEN** the system rejects creation with a validation message

#### Scenario: Assign existing participant to group

- **WHEN** a link holder adds a participant to an existing group
- **THEN** the participant is added to the group and becomes available for future group-assigned expenses

#### Scenario: Participant in multiple groups

- **WHEN** a participant is assigned to more than one group
- **THEN** the participant appears in each group's member list; expenses selecting multiple groups combine unique members across all selected groups

### Requirement: Group selection in expense entry

The system SHALL allow link holders to select one or more groups when creating or editing an expense.

#### Scenario: Select group for expense

- **WHEN** a link holder opens the expense editor and checks one or more group checkboxes
- **THEN** the expense is assigned to all participants across the selected groups, and the split mode applies within that participant set

#### Scenario: Group selection overrides individual assignment

- **WHEN** a expense has groups selected AND individual participant checkboxes are also touched
- **THEN** the group selection takes precedence; individual selections within the groups are ignored for balance computation

#### Scenario: No groups selected

- **WHEN** no group checkboxes are checked
- **THEN** the expense behaves exactly as before (individual participant selection, evenParticipantIds, etc.)

### Requirement: Group-aware balance computation

The system SHALL derive net balances using only the participants across the selected groups.

#### Scenario: Expense assigned to one group

- **WHEN** an expense has `groupIds: [Group A]` and split mode is `even`
- **THEN** the total is divided equally among only the members of Group A

#### Scenario: Expense assigned to multiple groups

- **WHEN** an expense has `groupIds: [Group A, Group B]` and split mode is `even`
- **THEN** the total is divided equally among the union of all members across Group A and Group B (no duplicates)

#### Scenario: Group-aware itemized mode

- **WHEN** an expense has groups selected and split mode is `itemized`
- **THEN** line item assignments use participants from the selected groups; tax/tip are allocated proportionally within the group participant set

#### Scenario: Existing expenses unaffected

- **WHEN** an expense has no `groupIds` set (NULL or empty array)
- **THEN** balance computation uses original behavior: all participants, or `evenParticipantIds` for even mode
