## Purpose

A dedicated Typeform-style flow for creating new events, guiding users step-by-step through event name, participant addition, and share token generation.

## ADDED Requirements

### Requirement: User can create an event with a name

The system SHALL allow users to create a new event by providing a name.

#### Scenario: Successful event creation

- **WHEN** user enters a valid event name and proceeds through the Typeform steps
- **THEN** an event is created with a unique share token and the user is redirected to the event page

### Requirement: User can add participants to an event

The system SHALL allow users to add one or more participant names during event creation.

#### Scenario: Participant added successfully

- **WHEN** user adds participant names and proceeds to the next step
- **THEN** participants are associated with the event and appear in the event dashboard

### Requirement: Event generates a shareable link

The system SHALL generate an unguessable share token and provide a link for event access.

#### Scenario: Share token generated

- **WHEN** event creation completes
- **THEN** a shareable link at `/e/<token>` is generated and displayed to the user
