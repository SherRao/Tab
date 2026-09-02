## Why

When creating a new event, users can add people as "guests" (no account needed). Currently, guests have no email field — their entry is name-only. Users have requested an optional email field for guests so that a person can be added as a guest with an email address that can be claimed linked to an account later, without immediately sending an invitation email.

## What Changes

- **Add optional `email` field to guest participants**: When adding a person as a guest, an optional email address can be provided. The email is stored in the database but does not trigger an automatic invitation email.
- **Parse `Name email@domain.com` input in search chooser**: The people addition UI will detect when input contains a name followed by an email address and offer it as a guest-with-email choice, distinct from the existing "invite" mode.
- **Preserve email when linking account**: When a guest-with-email is later claimed as an account, the email is preserved on the participant record.

## Capabilities

### New Capabilities

- `participants/guest-email`: Guest participants can optionally have an email stored. The system tracks whether a guest was added with email and preserves it through account claiming. This capability modifies how participants are created, stored, and linked.

### Modified Capabilities

(none - no existing capability requirements change)

## Impact

- `src/lib/participants.ts`: `AddParticipantInput` type adds optional `email` for guest mode; `addParticipant` stores email + `invitedAt` when provided; `linkAccountToParticipant` preserves email.
- `src/lib/queries.ts`: `addParticipantRecord` mirrors guest+email logic.
- `src/components/people/search-chooser.tsx`: `buildChoices` parses `Name email@domain.com` → guest mode with email; `email@domain.com` only → invite mode.
- `src/components/people/create-event-people-input.tsx`: Entry display shows email badge for guest entries when present.
- Email invitation flow (`src/lib/actions.ts`): Unchanged — guest+email entries do not trigger auto-invites since `person.email != null` check guards the invite loop.