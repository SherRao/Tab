# event-creation Specification

## Purpose

A dedicated, step-by-step flow at `/create` for opening a new tab, guiding the
user through the tab name and the people on it before generating a share token.

## Requirements

### Requirement: Tab creation happens on a dedicated page

The system SHALL host tab creation at `/create`, separate from the marketing home page, and SHALL require a signed-in viewer.

#### Scenario: Signed-in user opens the create page

- **WHEN** a signed-in user navigates to `/create`
- **THEN** the step-by-step create form is shown, starting at step 1 of 2

#### Scenario: Signed-out user opens the create page

- **WHEN** a signed-out user navigates to `/create`
- **THEN** they are redirected to sign in and returned to `/create` afterwards

### Requirement: User can name the tab

The system SHALL require a non-empty tab name before the user can proceed to the people step.

#### Scenario: Name provided

- **WHEN** the user enters a non-blank name and continues
- **THEN** the form advances to the people step and retains the entered name

#### Scenario: Name blank

- **WHEN** the name is empty or only whitespace
- **THEN** the form does not advance

### Requirement: User can add people to the tab

The system SHALL allow the user to add people — existing accounts, guests, or invite-by-email entries — and SHALL require at least one person besides the creator.

#### Scenario: Enough people added

- **WHEN** the user has added at least one other person
- **THEN** submission is enabled and the added people become participants on the created tab

#### Scenario: Not enough people

- **WHEN** no other person has been added
- **THEN** submission is disabled and the control prompts for one more person

#### Scenario: User returns to the name step

- **WHEN** the user chooses "Back" from the people step
- **THEN** the name step is shown again with the previously entered name intact

### Requirement: Creation generates a shareable link

The system SHALL generate an unguessable share token on submit and send the user to the tab.

#### Scenario: Share token generated

- **WHEN** creation succeeds
- **THEN** the user is redirected to `/e/<token>`, where the share link can be copied

#### Scenario: Creation fails validation

- **WHEN** the submitted name or people list is rejected by the server
- **THEN** the user is returned to `/create` with an inline error explaining that a name and one other person are required
