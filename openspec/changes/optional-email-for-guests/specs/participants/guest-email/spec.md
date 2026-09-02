## Purpose

Lets guests added to an event optionally store an email address that can be claimed and linked to an account later, without immediately sending an invitation email.

## ADDED Requirements

### Requirement: Guest participants may optionally provide an email

The system SHALL allow a guest participant to be created with an optional email address. When provided, the email is stored in the participant record and associated with the event. The email does not trigger an automatic invitation email, and `invitedAt` is left unset.

#### Scenario: Guest with email is stored without sending invitation

- **WHEN** the event owner adds a person as a guest with an email address (e.g., "John john@example.com")
- **AND** the person is not an existing account user
- **THEN** the participant is created with mode "guest", the email is stored (lowercased, trimmed), and `invitedAt` is not set
- **AND** no invitation email is sent
- **AND** the participant appears in the event's participant list with a "no account" badge

#### Scenario: Guest without email behaves as before

- **WHEN** the event owner adds a person as a guest with only a name (e.g., "John")
- **THEN** the participant is created with mode "guest", no email is stored, and no invitation email is sent
- **AND** the participant appears in the participant list with a "no account" badge

#### Scenario: Guest email is lowercased and trimmed on storage

- **WHEN** a guest is added with email "  John@Example.COM "
- **THEN** the stored email is "john@example.com" (lowercased and trimmed)
- **AND** the participant record reflects the normalized email

#### Scenario: Guest with email is added from the event page without invitation

- **WHEN** a signed-in user adds a person as a guest with an email address from the event page add-control
- **THEN** the participant is created with mode "guest" and the email is stored
- **AND** no invitation email is sent

#### Scenario: Guest with email can be claimed by a signed-in user

- **WHEN** a guest with a stored email requests to claim their participant as themselves
- **AND** the event owner approves the claim
- **THEN** the participant is linked to that user's account
- **AND** the stored email is cleared from the participant record