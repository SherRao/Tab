## Context

The Tab application allows event creators to add people to events. Currently, three modes exist when adding people: `account` (links existing user), `guest` (name only), and `invite` (email, sends invitation). This design adds an optional email field to guest mode, allowing a guest to be added with an email that can be claimed later.

## Goals / Non-Goals

**Goals:**
- Allow users to optionally provide an email when adding a guest to an event
- Store the email in the participant record without triggering an invitation email
- Preserve the email when a guest is later claimed as an account user
- Maintain backward compatibility with existing guest (no email) and invite modes

**Non-Goals:**
- Sending an invitation email when a guest is added with email (this remains opt-in via the "invite" mode)
- Changing the account or invite mode behavior
- Adding a new account creation flow

## Decisions

### 1. Input Parsing in Search Chooser
- **Decision**: Parse `Name email@domain.com` as guest-with-email; `email@domain.com` only as invite mode.
- **Rationale**: Distinguishes between inviting someone (who needs an account) and adding a guest with contact info. The email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` is used to detect email addresses.
- **Alternative**: Always show an additional text field after selecting "guest" mode. Rejected because it adds friction; parsing inline is more seamless.

### 2. Storage: Email + invitedAt when provided
- **Decision**: When guest mode has an email, store both `email` and set `invitedAt` to now; when no email, store neither (behavior unchanged).
- **Rationale**: The `invitedAt` field exists in the schema; populating it only when email is present avoids meaningless timestamps for pure guests.
- **Alternative**: Always set `invitedAt` for all guests. Rejected because it conflates "was invited" with "has an email address."

### 3. Account Claiming Preserves Email
- **Decision**: When `linkAccountToParticipant` runs on a guest-with-email, the email is preserved on the participant record (not cleared).
- **Rationale**: The whole point of adding a guest with email is that the email can later be claimed. Clearing it would defeat the purpose.
- **Alternative**: Clear email when linking account (existing behavior). Rejected because it removes the feature's value.

### 4. No Auto-Invite for Guest+Email
- **Decision**: The existing email invitation loops in `actions.ts` check `person.email == null`, so guest+email entries do NOT trigger invitation emails.
- **Rationale**: Guest-with-email is explicitly different from invite mode; auto-inviting would contradict the use case of "claim later."
- **Alternative**: Send invitation email anyway. Rejected because it blurs the line between guest+email and invite modes.

### 5. Duplicate Email Prevention
- **Decision**: `assertEmailFreeInEvent` continues to prevent duplicate emails within an event for invite mode. For guest+email, the same check applies when the email is provided.
- **Rationale**: Prevents two guests with the same email in one event, which would be confusing.
- **Alternative**: Skip duplicate check for guest mode. Rejected because it could lead to ambiguous state.

## Risks / Trade-offs

- [Risk] Users might confuse guest+email with invite mode, expecting an invitation email. 
  - [Mitigation] The UI badge clearly distinguishes "invited" (invite mode) from the new guest email behavior.
  
- [Risk] Duplicate emails across different events are not prevented (only within the same event).
  - [Mitigation] This is acceptable; the feature is per-event and duplicates across events are unlikely to cause issues.

- [Risk] When a guest-with-email claims their account, the email already being stored might conflict with email uniqueness if they try to create a new account with the same email.
  - [Mitigation] The existing account creation/validation handles email uniqueness at the user level; this feature just stores the email on a participant, not as a full user account.