## Context

The Tab application allows event creators to add people to events. Currently, three modes exist when adding people: `account` (links existing user), `guest` (name only), and `invite` (email, sends invitation). Adding people happens through one shared `SearchChooser`, used by both the create-tab flow (`create-event-people-input`) and the event-page add flow (`add-someone-control`). This design adds an optional email field to guest mode, allowing a guest to be added with an email that can be claimed later.

## Goals / Non-Goals

**Goals:**
- Allow users to optionally provide an email when adding a guest to an event
- Store the email in the participant record without triggering an invitation email
- Keep guests-with-email labeled as guests, not "invited"
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

### 2. Storage: email stored, invitedAt left unset
- **Decision**: When guest mode has an email, store the normalized email but leave `invitedAt` unset. With no email, behavior is unchanged.
- **Rationale**: `invitedAt` is the marker that an invitation email was actually sent. Keeping it unset for guests-with-email is what distinguishes this mode from `invite` — and it is what prevents both invitation loops (see Decision 4) from emailing them.
- **Alternative**: Set `invitedAt` whenever an email is present. Rejected: it makes guest-with-email indistinguishable from invite-mode in the DB and, given `createEventAction`'s invite loop keys on email presence, would auto-send an invitation — contradicting the feature's purpose.

### 3. Account Claiming Leaves linkAccountToParticipant Unchanged
- **Decision**: `linkAccountToParticipant` keeps its current behavior — on a successful claim it sets `userId` and clears `email`/`invitedAt`.
- **Rationale**: After linking, the participant's identity comes from the user row, which holds its own email; the participant-level email is redundant. Keeping the existing behavior avoids extra cleanup and keeps the participant record single-purpose.
- **Alternative**: Preserve the email on the linked participant. Rejected: it duplicates identity already held by the account and offers no functional benefit.

### 4. No Auto-Invite for Guest+Email (invitation guards key on invitedAt)
- **Decision**: `createEventAction`'s invitation loop currently skips only when `person.email == null` — with email now stored on guests that guard is no longer sufficient. The loop must additionally require `person.invitedAt != null`. `addParticipantAction` already sends only when `row.email != null && row.invitedAt != null`, so its send condition is unchanged — but it must forward the optional guest email into the input (Decision 6).
- **Rationale**: Invitations must be sent only to `invite`-mode rows. `invitedAt` is the single source of truth for "invitation was sent"; email presence alone no longer implies one.
- **Alternative**: Track guest-email with a separate column. Rejected: `invitedAt` already encodes exactly this distinction with no schema change.

### 5. Duplicate Email Prevention
- **Decision**: `assertEmailFreeInEvent` continues to prevent duplicate emails within an event. It applies to guest-with-email too, so no two participants in the same event share an email, regardless of mode.
- **Rationale**: Prevents two people in one event being represented by the same email, which would be confusing for later claiming.
- **Alternative**: Skip duplicate check for guest mode. Rejected because it could lead to ambiguous claim targets.
- **Note**: The check's error message ("That email is already invited to this event") assumes invite mode; update the copy to read mode-neutrally (e.g. "That email is already on this event") since it can now fire for guests too.

### 6. Event-Page Add Flow Forwards Guest Email
- **Decision**: `addParticipantAction` constructs `AddParticipantInput` from the parsed entry and currently drops the email for guest mode. It will forward `parsed.email` when present.
- **Rationale**: `SearchChooser` is shared between the create flow and the event-page add control (`AddSomeoneControl`), so the same `Name email@domain.com` choice appears in both. Both surfaces must persist the email or the feature is half-wired.
- **Alternative**: Restrict guest-email parsing to the create flow only. Rejected: inconsistent across surfaces and surprising on the event page.

### 7. participantState Keys "invited" on invitedAt
- **Decision**: `participantState` currently returns "invited" whenever `email != null`. It will return "invited" only when an invitation was sent — `email != null && invitedAt != null`. A guest-with-email (email set, invitedAt null) reads as "guest".
- **Rationale**: The dashboard "invited" badge means an invitation email was sent. A guest who merely has an email on file and never received one should keep the "no account" badge.
- **Alternative**: Keep email-only → "invited". Rejected: mislabels guests who were never emailed and contradicts the no-auto-invite behavior.

## Risks / Trade-offs

- [Risk] Users might confuse guest+email with invite mode, expecting an invitation email.
  - [Mitigation] Guests-with-email keep the "no account" badge and never receive an email; only invite-mode sends invitations, so there is nothing to wait for on the guest path.

- [Risk] A guest-with-email who never gets an invitation has no push channel to be drawn back to the tab.
  - [Mitigation] Same as any other guest: the share link is the entry point and the existing "request to claim" flow on the event page is how they claim later.

- [Risk] Duplicate emails across different events are not prevented (only within the same event).
  - [Mitigation] This is acceptable; the feature is per-event and duplicates across events are unlikely to cause issues.

- [Risk] When a guest-with-email claims their account, the email already being stored might conflict with email uniqueness if they try to create a new account with the same email.
  - [Mitigation] The existing account creation/validation handles email uniqueness at the user level; this feature just stores the email on a participant, not as a full user account.