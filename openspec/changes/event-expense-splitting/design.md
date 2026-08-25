## Context

Greenfield project — no existing code. The proposal defines a Next.js full-stack web app where facts (expenses, line items, assignments) are stored and balances/settlements are always derived. See proposal.md for motivation and the specs for behavioral contracts.

## Goals / Non-Goals

**Goals:**

- Correct, auditable ledger math: cents-safe arithmetic, balances that sum to zero
- Derivation-only balances (no stored balance state to fall out of sync)
- Receipt-entry UX as the core flow, not an afterthought

**Non-Goals:**

- User accounts/auth (future change attaches users to participants)
- OCR receipt scanning, multi-currency, notifications
- Minimum-transfer-count optimization beyond greedy (NP-hard; unnecessary)

## Decisions

### D1: Stack — Next.js App Router + TypeScript + Drizzle ORM + SQLite

One language across UI and ledger logic; server components for event views, client components for the receipt editor. SQLite keeps local dev frictionless and is sufficient for link-shared events; Drizzle's schema is portable to Postgres later.
_Alternative considered_: React SPA + separate API — more moving parts for no benefit at this scale.

### D2: Money as integer cents

All amounts stored as integer cents (`INTEGER` columns). Floating point is never used in ledger math. Proportional tax/tip allocation uses largest-remainder rounding so allocated cents always sum exactly to the tax/tip amount.

### D3: Data model

```
events        { id, name, shareToken (unique), createdAt }
participants  { id, eventId → events, name, addedAt }
expenses      { id, eventId → events, payerId → participants,
                description, taxCents, tipCents, totalCents,
                splitMode: 'itemized' | 'even' | 'group',
                evenParticipantIds (json, only for even mode),
                createdAt }
lineItems     { id, expenseId → expenses, name, amountCents }
lineItemShares { lineItemId → lineItems, participantId → participants }
```

`even` mode ignores line items entirely; `group` mode treats every line item as shared by all participants at computation time (no per-item rows needed). Deleting a participant is out of scope for v1 (only adding is specified); deletion can be a future change since it interacts with past expenses.

### D4: Consumption pipeline (pure functions)

```
stored facts ──▶ consumption(event) ──▶ netBalances(event) ──▶ simplify(nets)
                 per-participant:      paid − consumed         greedy
                 item cost + prop.                             min-cash-flow
                 tax + tip
```

Each stage is a pure, unit-testable function taking plain data. `simplify` repeatedly transfers between max creditor and max debtor; ≤ n−1 transfers guaranteed.

### D5: Tax/tip allocation strategy

Proportional to pre-tax subtotal (matches fairness intuition and receipt reality). No per-item tax entry. Same treatment for tip.

### D6: Share tokens via `nanoid`

High-entropy random token in the URL path (`/e/<token>`) — unguessable, no auth layer needed. Unknown tokens return 404 without enumeration hints.

### D7: Reconciliation warning is non-blocking

Line items + tax + tip vs total mismatch shows a visible discrepancy warning but permits saving (receipts are messy; blocking would frustrate entry).

## Risks / Trade-offs

- [Anyone with the link can edit/delete anything] → Accepted v1 trade-off, documented in spec; accounts change will add identity later
- [Rounding edge cases in proportional allocation] → Largest-remainder method + property test asserting allocations sum to source amount
- [SQLite concurrent writes] → Single-writer WAL mode is ample for friend-group usage; migrate to Postgres if ever needed
- [Even-mode participant list drift when participants added later] → Even splits capture the participant set at save time; later additions don't retroactively alter old expenses (per spec)

## Migration Plan

Initial schema migration created alongside app scaffold; no deployment or rollback concerns (greenfield).

## Open Questions

None blocking — remaining choices (exact UI library, styling approach) are implementation-level and deferred to tasks/apply.
