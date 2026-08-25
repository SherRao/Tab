## ADDED Requirements

### Requirement: Event ownership

The system SHALL record exactly one owner for every event — the account that created it. Ownership SHALL grant authority over guest claim approvals, and the owner's events SHALL be listed for them in one place.

#### Scenario: Creator becomes owner

- **WHEN** a signed-in user creates an event
- **THEN** their account is recorded as the event's sole owner

#### Scenario: Owned tabs listing

- **WHEN** a signed-in user opens their tabs page
- **THEN** they see all events they own, each linking to its event page

#### Scenario: Owner-only approval surface

- **WHEN** a non-owner views the event
- **THEN** they are not offered the owner's pending claim decisions

## MODIFIED Requirements

### Requirement: Event creation

The system SHALL allow a signed-in user to create an event with a name and an initial list of participants, where each participant may be a picked account, a bare name, or a name plus email to invite; creating an event SHALL require an account, and the creator becomes its owner.

#### Scenario: Create event with participants

- **WHEN** a signed-in user submits an event name and at least two participants
- **THEN** the system creates the event owned by that account, stores the participants in their chosen states, and presents a shareable link

#### Scenario: Reject empty participants

- **WHEN** a signed-in user submits an event with fewer than two participants
- **THEN** the system rejects creation with a validation message

#### Scenario: Signed-out visitors cannot create

- **WHEN** a visitor who is not signed in attempts to create an event
- **THEN** the system prompts them to sign in first instead of creating anything

### Requirement: Shareable link access

The system SHALL give each event an unguessable link (random high-entropy token) that grants read access — expenses, balances, and settlements — to anyone holding it, signed-in or not.

#### Scenario: Open shared link

- **WHEN** anyone opens a valid event link
- **THEN** they can view all expenses, balances, and settlements for that event

#### Scenario: Invalid or unknown link

- **WHEN** someone opens a link that does not correspond to any event
- **THEN** the system shows a not-found page without revealing whether events exist

### Requirement: Link-based access trade-off

The system SHALL authorize mutations by session rather than by possession of the link: reading requires only the link, while any state-changing action — adding participants, inviting, claiming, creating, editing, or deleting expenses — SHALL require a signed-in account. Any signed-in holder of the link may manage the event's expenses and participants; the owner alone decides guest claims.

#### Scenario: Signed-out holder is read-only

- **WHEN** a person who is not signed in opens an event link and attempts any modification
- **THEN** the system performs no change and directs them to sign in

#### Scenario: Any signed-in holder can edit

- **WHEN** a signed-in user holding the link edits or deletes an expense
- **THEN** the change is applied immediately without additional authorization
