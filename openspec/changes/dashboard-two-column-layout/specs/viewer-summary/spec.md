## Purpose

Shows the signed-in viewer their personal net position on the event dashboard so they can instantly see what they owe or are owed without scanning the full balance list.

## ADDED Requirements

### Requirement: Viewer net-position summary

When a signed-in user views an event dashboard and is a participant, the system SHALL display a personal summary showing their net balance direction (owed or owe), the absolute amount, and how many other participants are involved in that direction.

#### Scenario: Viewer is owed money
- **WHEN** a signed-in viewer is a participant and their net balance is positive
- **THEN** the dashboard displays a summary reading "You get back {amount} from {count} {people}" where amount is their net balance formatted as currency and count is the number of participants who owe them money

#### Scenario: Viewer owes money
- **WHEN** a signed-in viewer is a participant and their net balance is negative
- **THEN** the dashboard displays a summary reading "You owe {amount} to {count} {people}" where amount is their net balance (absolute) formatted as currency and count is the number of participants they owe money to

#### Scenario: Viewer is settled
- **WHEN** a signed-in viewer is a participant and their net balance is zero
- **THEN** the dashboard displays a summary reading "You're all settled"

### Requirement: Non-participant viewer nudge

When a signed-in user views an event dashboard but is not yet a participant, the system SHALL display a nudge indicating they are not in the tab.

#### Scenario: Signed-in non-participant
- **WHEN** a signed-in user views an event and is not a participant
- **THEN** the dashboard displays "You're not in this tab yet"

### Requirement: Anonymous viewer exclusion

The system SHALL NOT display any personal summary for anonymous (not signed-in) viewers.

#### Scenario: Anonymous viewer
- **WHEN** a user views an event without being signed in
- **THEN** no personal summary is displayed
