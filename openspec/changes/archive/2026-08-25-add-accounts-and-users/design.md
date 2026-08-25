## Context

Tab is a Next.js 16 App Router app (TypeScript, Drizzle ORM, better-sqlite3/WAL) where identity is currently a name string on `participants` and the share token is the only access mechanism — there is no auth, no session, no email. All mutations flow through server actions in `src/lib/actions.ts`; reads go through `src/lib/queries.ts`. The ledger math is pure integer-cents functions over participant ids and is untouched by this change. See proposal.md for motivation and specs/ for behavior.

Constraint from AGENTS.md that this change deliberately supersedes: "Event access is the share token — there is no auth." Reading stays token-based; writing becomes session-gated.

## Goals / Non-Goals

**Goals**

- Accounts with magic-link auth and cookie sessions; no passwords anywhere.
- Participant identity states (linked / invited / guest) without disturbing ledger math.
- Owner authority model: ownership recorded per event; owner adjudicates guest claims.
- Minimal dependency footprint: one email SDK, Node crypto for tokens.

**Non-Goals**

- OAuth / social sign-in (future addition; magic link is the only path now).
- Passwords, MFA, account settings UI beyond display-name/username basics.
- Roles or granular permissions beyond "owner vs any signed-in holder".
- Email verification as a separate concept (the magic link _is_ verification).
- Migration of existing anonymous events to owners (see Migration Plan).

## Decisions

### D1: Roll our own magic-link auth (no auth framework)

Sessions are a random 32-byte token stored hashed in an `auth_tokens`-adjacent `sessions` table; cookie is HTTP-only, SameSite=Lax, secure in production. Login tokens are single-use, 15-minute expiry; session cookies 30-day sliding expiry.

_Why not Auth.js/Lucia/Better-Auth_: none support SQLite+drizzle zero-config better than ~80 lines we control, and every one pulls adapter layers we don't need. Magic link + session is small enough to own. _Alternative rejected_: signing JWTs directly (no server-side revocation; sign-out wouldn't actually kill sessions).

Token hashing: store SHA-256 of token, look up by hash — a DB leak doesn't yield usable links.

### D2: Email via tiny `sendEmail` interface

`sendEmail({ to, subject, text })` in `src/lib/email.ts`. Implementation chosen at import: if `RESEND_API_KEY` is set → Resend SDK; otherwise log to console (`[email:dev] to=... body=...`). Dev never sends externally. No template engine — plain-text emails fit receipts-and-ledgers tone.

### D3: Identity resolution on the participant row

`participants` gains nullable `user_id`, `email`, `invited_at`. State derivation:

```
user_id != null          → linked    (display = users.display_name)
user_id null, email set  → invited   (display = participants.name)
otherwise                → guest     (display = participants.name)
```

`name` is kept for non-linked rows and ignored for linked ones. No separate invite table — the participant row is the invitation, so claiming is a single UPDATE and balances/shares never move. `expenses.payerId` and `line_item_shares.participantId` FKs stay pointed at stable participant ids throughout.

Uniqueness guards: unique index on lowercased email in `users`; partial unique index on `participants.user_id` (one linked participant per account per event) enforced in actions too for clear error messages; action-level check for duplicate invited emails per event.

Emails stored lowercased everywhere; all comparisons case-insensitive.

### D4: Account search is explicit selection only

A server query endpoint (`?q=`) returns up to 8 accounts matching prefix/substring on username or exact email, **only for signed-in users**. The combobox offers: matching accounts ("@username — Display Name"), then affordances to add typed text as guest, or as invite when it parses as an email. Submission payload carries an explicit mode (`account` | `guest` | `invite`) — the action re-validates the account id exists rather than trusting typed strings. This makes D4's "no silent attach" rule structural: you cannot submit an account linkage without having clicked a suggestion.

### D5: Claim flow = request row + owner approval

New `participant_claims` table: `participant_id`, `requester_user_id`, `status(pending/approved/denied)`, timestamps. Requester creates claim from the event page (visible on guests); owner sees pending claims inline on the event page with approve/deny forms. Approval runs `UPDATE participants SET user_id = requester` inside the uniqueness check. One pending claim per (participant, requester). Self-service merge needs no data migration of shares — see D3.

_Why not silent claim_: bare-name guests carry no credential; the owner is the only trust anchor who can vouch "Bob is this Bob". Decided during exploration.

### D6: Gating lives in the server actions, not the page

Every mutating action calls `requireSession()` (redirects to `/signin?next=...` when absent) before touching the DB. Pages render read-only views regardless of session state; hiding buttons for signed-out users is progressive enhancement, not security. Event creation form moves behind sign-in on `/`.

### D7: Existing-data backfill

Current tables have real anonymous rows. Migration strategy:

- `users`: new table, empty.
- `events.owner_id`: column added NOT NULL is impossible with existing rows → add nullable, then backfill: events whose participants are all claimed later get owners naturally; for now create placeholder behavior instead — keep `owner_id` nullable at the DB level but treat NULL as "orphaned legacy event": view-only for everyone, nobody can approve claims or edit until adopted. Adoption path (sign-in → "this tab is mine") is out of scope; spec requires ownership for _newly created_ events.
- `participants.user_id/email/invited_at`: added nullable; all existing rows become guests automatically — correct semantics, zero data loss.

### D8: Route map

- `/signin` — request link (email form) + complete signup (username/display name after following a signup link)
- `/tabs` — owned events list (server component)
- `/e/[token]` — unchanged layout + search combobox replacing name input + claims surface for owner + read-only notice for signed-out
- `/` — landing keeps marketing; create form requires session (prompt to sign in)
- Magic-link landing: `/auth/verify?token=...` validates token, establishes or completes session

## Risks / Trade-offs

- [Deliverability is now a login dependency] → dev logs links; production failure surfaces a "we couldn't send your email" error with retry. Resend is the only external dependency and it's swappable behind `sendEmail`.
- [Account enumeration via search] → search is signed-in-only; signin/signup responses are indistinguishable for unknown vs known emails (single response copy).
- [Owner never responds to claims] → claims are visible inline on the event page the owner already uses; stale pending claims are harmless (guest stays guest).
- [SQLite partial indexes + drizzle-kit] → generated SQL verified locally during migration generation; fallback is enforcing uniqueness purely in actions (already done).
- [Legacy orphaned events have no owner] → documented behavior (view-only), not a bug; adoption feature deferred.
- [Session table growth] → sliding-expiry updates touch rows rather than inserting; periodic cleanup out of scope.

## Migration Plan

1. Generate drizzle migration adding `users`, `sessions`, `auth_tokens`, `participant_claims`, new `participants` columns, nullable `events.owner_id`.
2. Apply migration; existing rows degrade gracefully (events = orphaned/view-only-write-less, participants = guests).
3. Deploy code; new event creation requires sign-in from this point.
4. Set `RESEND_API_KEY` in production env before announcing; dev unaffected.
5. Rollback: revert deploy; schema is additive except `events.owner_id` NOT NULL being skipped (D7 keeps it nullable), so old code keeps running against the new schema.

## Open Questions

None blocking. Deferred by design: event adoption for legacy tabs, Google OAuth addition, email templates, session cleanup job.
