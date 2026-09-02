## Why

When creating a new event, users can add people as "guests" (no account needed). Currently, guests have no email field — their entry is name-only. Users have requested an optional email field for guests so that a person can be added as a guest with an email address that can be claimed and linked to an account later, without immediately sending an invitation email.

## What Changes

- **Add optional `email` field to guest participants**: When adding a person as a guest, an optional email address can be provided. The email is stored in the database (lowercased, trimmed) but does not trigger an automatic invitation email. `invitedAt` is left unset so a guest-with-email stays distinguishable from invite-mode.
- **Parse `Name email@domain.com` input in the shared search chooser**: The people addition UI — used by both the create-tab flow and the event-page add flow — will detect a name followed by an email address and offer it as a guest-with-email choice, distinct from the existing "invite" mode.
- **Guard invitation emails with `invitedAt`**: Guests-with-email must never receive an automatic invitation. `createEventAction` will only send invitations to participants whose `invitedAt` is set; `addParticipantAction` already requires both `email` and `invitedAt`.
- **Pass optional guest email through the event-page add flow**: `addParticipantAction` forwards an optional guest email into storage, matching the create flow.
- **Label guests-with-email as guests, not invited**: `participantState` treats a participant as "invited" only when an invitation was actually sent (`invitedAt` set). A guest with a stored email keeps the "no account" badge.

## Capabilities

### New Capabilities

- `participants/guest-email`: Guest participants can optionally have an email stored. The system tracks that a guest was added with email, keeps such guests off the automatic invitation path, and labels them as guests (not invited). Claiming an account works as it does for any guest. This capability modifies how participants are created, stored, and displayed.

### Modified Capabilities

(none - no existing capability requirements change)

## Impact

- `src/lib/participants.ts`: `AddParticipantInput` guest variant gains optional `email`; `addParticipant` stores email without setting `invitedAt`; `participantState` returns "invited" only when `invitedAt` is set. `linkAccountToParticipant` unchanged — claiming still clears email.
- `src/lib/queries.ts`: `addParticipantRecord` mirrors guest+email storage.
- `src/components/people/search-chooser.tsx`: `buildChoices` parses `Name email@domain.com` → guest mode with email; bare `email@domain.com` → invite mode; `EntryChoice` guest variant gains optional `email`. Shared by the create-tab and event-page add flows.
- `src/components/people/create-event-people-input.tsx`: Entry chip shows the guest email when present, with the "no account" badge.
- `src/lib/actions.ts`: `createEventAction`'s invite loop additionally requires `person.invitedAt != null` before sending; `addParticipantAction` forwards an optional guest email into `AddParticipantInput`.
- `src/lib/__tests__/accounts-flow.integration.test.ts`: extends coverage for guest-with-email creation and event-page add.