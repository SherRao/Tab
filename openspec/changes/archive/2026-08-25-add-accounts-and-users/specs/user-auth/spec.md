## Purpose

Lets people create accounts and sign in using magic links emailed to them — no passwords — and keeps them signed in across requests. Also delivers the transactional emails (login links, invitations) behind a provider-agnostic send interface.

## ADDED Requirements

### Requirement: Account creation by magic link

The system SHALL let a visitor create an account by submitting an email address and completing sign-up through a link emailed to that address. Completing sign-up SHALL require choosing a unique username and a display name.

#### Scenario: Sign up with a fresh email

- **WHEN** a visitor submits an email address not associated with any account and follows the emailed link
- **THEN** the system lets them choose a username and display name, creates the account bound to that email, and signs them in

#### Scenario: Duplicate username

- **WHEN** a visitor chooses a username already taken by another account
- **THEN** the system rejects the choice and asks for a different username

#### Scenario: Repeated email

- **WHEN** a visitor submits an email address that already belongs to an account
- **THEN** the system sends that address a sign-in link instead of creating a second account

### Requirement: Magic-link sign-in

The system SHALL let a registered person sign in by submitting their account email and following a login link emailed to that address, without ever handling a password.

#### Scenario: Sign in via emailed link

- **WHEN** a person submits the email of an existing account and follows the emailed link
- **THEN** they are signed in to that account

#### Scenario: Unknown email is not distinguishable

- **WHEN** a person submits an email address that does not belong to any account
- **THEN** the system responds the same way as for a known email, so account existence is not revealed

### Requirement: Single-use expiring links

The system SHALL make each emailed authentication link valid for at most one use and for a limited time, and SHALL reject links that were already consumed or expired.

#### Scenario: Link reused

- **WHEN** the same authentication link is opened a second time
- **THEN** the system rejects it and asks the person to request a new one

#### Scenario: Link expired

- **WHEN** an authentication link is opened after its expiry
- **THEN** the system rejects it and asks the person to request a new one

### Requirement: Session lifecycle

The system SHALL maintain signed-in state with an HTTP-only cookie session, keep the person signed in across requests until they sign out or the session expires, and clear the session on sign-out.

#### Scenario: Signed-in state persists

- **WHEN** a signed-in person navigates to any page
- **THEN** the app recognizes their account without re-authentication

#### Scenario: Sign out

- **WHEN** a signed-in person signs out
- **THEN** the session is cleared and subsequent requests are treated as signed-out

### Requirement: Transactional email delivery

The system SHALL send authentication and invitation emails through a single send interface: in development the email content including the link is written to the server log instead of being sent; in production it is delivered through the configured email provider.

#### Scenario: Development delivery

- **WHEN** the app needs to deliver a magic link in development
- **THEN** the full link is logged to the server console and no external email is sent

#### Scenario: Production delivery

- **WHEN** the app needs to deliver a magic link in production with a provider configured
- **THEN** the email is handed to the provider for delivery
