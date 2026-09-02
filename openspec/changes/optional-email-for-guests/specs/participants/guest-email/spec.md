## Purpose

Lets guests added to an event optionally store an email address that can be claimed linked to an account later, without immediately sending an invitation email.

## ADDED Requirements

### Requirement: Guest participants may optionally provide an email

The system SHALL allow a guest participant to be created with an optional email address. When provided, the email is stored in the participant record and associated with the event. The email does not trigger an automatic invitation email.

#### Scenario: Guest with email is stored without sending invitation

- **WHEN** the event owner adds a person as a guest with an email address (e.g., "John john@example.com")
- **AND** the person is not an existing account user
- **THEN** the participant is created with mode "guest", the email is stored (lowercased, trimmed), and no invitation email is sent
- **AND** the participant appears in the event's participant list with an "invited" badge showing the email

#### Scenario: Guest without email behaves as before

- **WHEN** the event owner adds a person as a guest with only a name (e.g., "John")
- **THEN** the participant is created with mode "guest", no email is stored, and no invitation email is sent
- **AND** the participant appears in the participant list with a "no account" badge

#### Scenario: Guest email is lowercased and trimmed on storage

- **WHEN** a guest is added with email "John DOE@Example.COM "
- **THEN** the stored email is "john.doe@example.com" (lowercased and trimmed)
- **AND** the participant record reflects the normalized email