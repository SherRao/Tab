## Purpose

Lets a person create an event (trip, night out) with named participants and share it through an unguessable link. The link is the only access mechanism in v1: anyone holding it can view the event and manage its expenses.

## ADDED Requirements

### Requirement: Event creation
The system SHALL allow a user to create an event with a name and an initial list of participant names, without requiring any account or login.

#### Scenario: Create event with participants
- **WHEN** a user submits an event name and at least two participant names
- **THEN** the system creates the event, stores the participants as name-only entries, and presents a shareable link

#### Scenario: Reject empty participants
- **WHEN** a user submits an event with fewer than two participants
- **THEN** the system rejects creation with a validation message

### Requirement: Shareable link access
The system SHALL give each event an unguessable link (random high-entropy token) that grants full access to view and modify the event and its expenses.

#### Scenario: Open shared link
- **WHEN** anyone opens a valid event link
- **THEN** they can view all expenses, balances, and settlements for that event

#### Scenario: Invalid or unknown link
- **WHEN** someone opens a link that does not correspond to any event
- **THEN** the system shows a not-found page without revealing whether events exist

### Requirement: Participant management
The system SHALL allow participants to be added to an existing event by anyone with the link.

#### Scenario: Add a participant mid-event
- **WHEN** a link holder adds a new participant name
- **THEN** the participant becomes available as a payer and line-item assignee, and participates in even/group splits going forward

#### Scenario: Participant with past expenses
- **WHEN** a participant is added after expenses exist
- **THEN** their balance is computed only from expenses recorded after they were added; prior expenses are unaffected

### Requirement: Link-based access trade-off
The system SHALL treat possession of the link as authorization: no per-user identity, roles, or permissions exist in v1.

#### Scenario: Any holder can edit
- **WHEN** any person holding the link edits or deletes an expense
- **THEN** the change is applied immediately without additional authorization
