## Purpose

Tracks who shares an event's expenses as linked accounts, email-pending invitees, or bare-name guests, and lets organizers add them through a single account-search input, invite them by email, and adjudicate guest self-claims.

## ADDED Requirements

### Requirement: Participant identity states

The system SHALL represent each event participant in exactly one of three states: linked to an account, invited (email recorded, signup pending), or guest (bare name only). A linked participant's displayed name SHALL come from their account display name; invited and guest participants SHALL display the name entered when they were added. Ledger math SHALL be unaffected by state — every participant can pay and be assigned items regardless of state.

#### Scenario: Linked participant shows account name

- **WHEN** an account-backed participant appears in balances, settlements, or receipt line items
- **THEN** their account display name is shown

#### Scenario: Guest participates fully in the ledger

- **WHEN** an expense assigns items to a bare-name guest
- **THEN** the guest's balance and settlement are computed identically to any other participant

#### Scenario: Account display name changes propagate

- **WHEN** a linked participant changes their account display name
- **THEN** every event where they participate shows the new name without any per-event edit

### Requirement: Adding participants via account search

The system SHALL let signed-in users add a participant by typing a username or email into a single search input that suggests matching accounts, linking an account only through explicit selection of a suggestion. The system MUST NOT silently link an account merely because typed text resembles one.

#### Scenario: Selecting a suggested account

- **WHEN** a signed-in user types text matching existing accounts and selects one from the suggestions
- **THEN** a participant linked to that account is added to the event

#### Scenario: Typed match is not auto-linked

- **WHEN** a signed-in user submits text exactly matching an existing account's email without selecting the suggestion
- **THEN** no account is silently linked; the user must either pick the suggestion or explicitly add a guest or invitation

#### Scenario: Search is for signed-in users only

- **WHEN** a signed-out visitor views the event
- **THEN** no account search or participant-adding interface is offered

#### Scenario: Already-added account

- **WHEN** a signed-in user searches for an account that already participates in the event
- **THEN** the suggestion indicates it is already added and cannot be added again

### Requirement: Email invitations

The system SHALL let signed-in users add a participant by providing a name and an email address for someone without a picked account, creating an invited participant immediately and sending that address an invitation email containing a sign-up link bound to this event and participant.

#### Scenario: Invite creates usable participant immediately

- **WHEN** a signed-in user adds a person by name and email
- **THEN** the invited participant is available right away as a payer and assignee, before they sign up

#### Scenario: Invitation email sent

- **WHEN** an invited participant is created
- **THEN** the given address receives an email with a working sign-up link for this event

#### Scenario: Duplicate email within event

- **WHEN** a signed-in user adds a participant with an email already used by another participant of the same event
- **THEN** the system rejects the addition

### Requirement: Auto-claim on invited signup

The system SHALL link an invited participant to the account created or signed into through that participant's invitation link, matching by the invited email, preserving all existing assignments and balances.

#### Scenario: Signup claims the invited seat

- **WHEN** a person signs up through an invitation link using the invited email address
- **THEN** the invited participant becomes linked to their new account with balances and item assignments unchanged

#### Scenario: Existing account claims via invite link

- **WHEN** a person who already has an account follows an invitation link addressed to their email and signs in
- **THEN** the invited participant becomes linked to that existing account

### Requirement: Guest self-claim with owner approval

The system SHALL let a signed-in user request to claim a bare-name guest participant as themselves, subject to the event owner's explicit approval; the claim links the requester's account to the guest participant only after approval, and denial leaves the guest untouched.

#### Scenario: Owner approves a claim

- **WHEN** a signed-in user requests a guest participant and the owner approves the request
- **THEN** the guest becomes linked to the requester's account with balances and assignments unchanged

#### Scenario: Owner denies a claim

- **WHEN** the owner denies a pending claim request
- **THEN** the participant remains a bare-name guest and the requester is not linked

#### Scenario: Only the owner decides

- **WHEN** someone other than the event owner attempts to approve or deny a claim request
- **THEN** the system refuses the action

#### Scenario: Claim request surfaced to owner

- **WHEN** a claim request is pending on the owner's event
- **THEN** the owner can see the pending request with the requester's identity and the guest's name

### Requirement: One account per event

The system SHALL prevent an account from being linked to more than one participant within the same event.

#### Scenario: Second linkage attempt rejected

- **WHEN** an operation would link an account that already backs another participant in the event
- **THEN** the system refuses the linkage and reports the conflict
