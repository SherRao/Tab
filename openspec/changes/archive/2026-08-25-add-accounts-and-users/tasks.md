## 1. Schema and email foundation

- [x] 1.1 Add `users`, `sessions`, `auth_tokens`, `participant_claims` tables and `participants.user_id/email/invited_at`, nullable `events.owner_id` to `src/db/schema.ts`; run `npm run db:generate` and `npm run db:migrate` and confirm migration applies cleanly
- [x] 1.2 Add `src/lib/email.ts` with `sendEmail` interface — console logging without `RESEND_API_KEY`, Resend SDK with it; verify dev log output with a temporary call, then remove it

## 2. Auth core

- [x] 2.1 Add `src/lib/auth.ts`: token generation (crypto random), SHA-256 token hashing, single-use/expiring login tokens, session create/read/destroy with HTTP-only cookie helpers (`getSession`, `requireSession`); unit-test token expiry and single-use behavior
- [x] 2.2 Add server actions `requestSignInAction` (indistinguishable response for known/unknown emails) and `completeSignUpAction` (unique username/display-name validation); verify via dev console that magic link is logged
- [x] 2.3 Add `/signin` page (email form + post-link signup form) and `/auth/verify` route that validates token then redirects; manually verify sign-in round trip in dev

## 3. Gating and ownership

- [x] 3.1 Gate all mutating actions in `src/lib/actions.ts` behind `requireSession()` and set `events.owner_id` on creation; add action-level test that unauthenticated mutation throws/redirects and authenticated succeeds
- [x] 3.2 Update `/e/[token]` page to render read-only for signed-out visitors (no mutating forms, sign-in prompt) and update `/` create flow to require session; manually verify both states

## 4. Participants: search, invite, claim

- [x] 4.1 Add signed-in-only account search query (username prefix/substring + exact email, max 8 results) and JSON endpoint; verify manual curl returns matches only when signed in
- [x] 4.2 Build account-search combobox client component (suggestions, "add as guest", "invite" affordances, already-added state) and replace the name-input form on `/e/[token]`; extend `addParticipantAction` with explicit mode payload re-validating account existence; verify each of the three add modes end-to-end in dev
- [x] 4.3 Send invitation email with per-participant signup link on invite creation; enforce duplicate-invited-email rejection per event; verify invited participant is immediately assignable in an expense
- [x] 4.4 Auto-claim invited participant when signup/sign-in happens through their invitation link (match by lowercased email); verify balances unchanged after claim and existing-account path claims too
- [x] 4.5 Implement guest self-claim request UI, `participant_claims` lifecycle, owner approve/deny actions and inline owner surface on `/e/[token]`; verify approve links account, deny leaves guest, non-owner cannot decide

## 5. Tabs listing and polish

- [x] 5.1 Add `/tabs` server component listing owned events linking to event pages; add nav entry visible when signed in; verify list reflects created events only for the owning user
- [x] 5.2 Update landing-page copy that advertises no-accounts ("No accounts for anybody", "No sign-up needed") to reflect accounts-first model; verify no stale copy remains

## 6. Verification

- [x] 6.1 Extend `src/lib/__tests__/flow.integration.test.ts` or add integration test covering: create owned event → search-add linked participant → add guest → invite → claim approval → ledger math unchanged throughout; run `npm test`
- [x] 6.2 Run `npm run lint`, typecheck, and `npm run build`; fix any failures
