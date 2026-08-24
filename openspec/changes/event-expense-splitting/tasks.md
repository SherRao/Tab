## 1. Scaffold

- [ ] 1.1 Create Next.js App Router project with TypeScript, Drizzle ORM, SQLite, and nanoid; verify `npm run dev` serves the app
- [ ] 1.2 Define Drizzle schema (events, participants, expenses, lineItems, lineItemShares per design.md D3) and run initial migration; verify tables exist with integer-cent columns

## 2. Ledger Core (pure functions)

- [ ] 2.1 Implement consumption computation: itemized shares + proportional tax/tip with largest-remainder rounding; verify unit tests pass for proportional allocation scenario and cents-sum invariant
- [ ] 2.2 Implement `even` and `group` mode consumption paths; verify unit tests match spec scenarios (even 3-way $90 split; group mode ignores assignments)
- [ ] 2.3 Implement net balance derivation and greedy min-cash-flow simplification; verify unit tests pass chain-cancellation and multi-debtor scenarios and balances sum to zero

## 3. Events & Sharing

- [ ] 3.1 Build event creation form (name + ≥2 participant names) with validation rejection; verify creating an event produces a share link at `/e/<token>`
- [ ] 3.2 Build event page served by share token: expense list, balances, settlement view; verify invalid token shows not-found page without enumeration hints
- [ ] 3.3 Add "add participant" action on the event page; verify new participant appears as payer/assignee option and prior expense balances are unchanged

## 4. Expense Entry

- [ ] 4.1 Build receipt-entry screen: payer select, dynamic line items (name + amount), tax, tip, total inputs; verify an itemized lunch saves and appears in the event expense list
- [ ] 4.2 Build line-item assignment UI (toggle participants per item) with quick actions: assign-all, even-mode toggle, group/birthday mode; verify shared $30 item between two people charges $15 each
- [ ] 4.3 Implement reconciliation check comparing items + tax + tip vs total with non-blocking discrepancy warning; verify mismatch shows warning and save still succeeds
- [ ] 4.4 Implement expense edit and delete actions; verify deleting an expense updates balances immediately

## 5. Balances UI & Integration

- [ ] 5.1 Render net balances and simplified settlement ("X pays Y $Z" list or "all settled" state) on the event page; verify against a hand-computed multi-expense fixture
- [ ] 5.2 Add integration test covering the full flow from exploration scenario: one person pays lunch + dinner, mixed assignments, birthday expense — verify final transfers are correct
- [ ] 5.3 Run lint/typecheck/build and full test suite; fix any issues
