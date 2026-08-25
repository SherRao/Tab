## Why

Tab currently treats a person as a name string scoped to one event: anyone holding the share link can edit everything, participants cannot be recognized across events, and there is no way to reach someone outside the app. Making accounts the center of the model gives people a persistent identity across tabs, lets organizers add people who already have accounts or reach them by email, and turns anonymous link-holders into read-only viewers instead of unattributed editors.

## What Changes

- **BREAKING**: Event creation requires a signed-in account; every event belongs to its creator (owner).
- **BREAKING**: The share link grants view-only access to signed-out visitors; all mutations (expenses, participants, merges) require a session.
- **BREAKING**: Participants gain identity states — linked to an account, invited (email pending signup), or guest (bare name) — replacing the name-only model.
- New `users` table with username, unique email, display name; magic-link authentication only (no passwords); HTTP-only session cookie.
- Adding a participant becomes a single typeahead over usernames and emails: picking a match links the account; no match allows adding a bare-name guest or an email invite.
- Email invitations carry a magic-link sign-up URL; signing up through it auto-claims the invited participant.
- Guests may claim themselves ("this guest is me"); claims require owner approval before linking.
- New `/tabs` page listing the signed-in user's owned events; landing page stays as-is.
- Small `sendEmail` interface: logs to console in dev, Resend in production.

## Capabilities

### New Capabilities

- `user-auth`: Account creation and magic-link sign-in, session lifecycle, and transactional email delivery for login/invite links.
- `participants`: Participant identity states (linked / guest / invited), account-search typeahead, email invites with auto-claim, and guest self-claims gated by owner approval.

### Modified Capabilities

- `events`: Events now belong to an owner; creation requires a session; the share link degrades from full access to view-only for signed-out visitors, with all writes requiring a session.

## Impact

- **Schema**: new `users` and `auth_tokens` tables; `events.owner_id` (NOT NULL); `participants.user_id`, `email`, `invited_at`; requires drizzle migration regeneration and data backfill strategy for existing rows.
- **Server actions**: every mutating action gains a session check; new actions for auth, invites, merge requests/approvals.
- **New dependencies**: Resend SDK (email). Token generation uses Node crypto — no new auth framework.
- **UI**: event page add-participant form replaced by account-search combobox; sign-in page; `/tabs` route; owner claim-approval surface; updated copy on the landing page (currently advertises "No accounts for anybody").
- **Unaffected**: ledger math (`computeNetBalances`, `simplifyDebts`) and receipt OCR operate on participant ids and remain unchanged.
