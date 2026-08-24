## Why

Splitting expenses for group trips and events is tedious: one person fronts money, tracking who consumed what across multiple bills is error-prone, and settling up produces a tangled web of transfers. Whole-expense splitting tools (e.g., Splitwise) lose line-item detail. We need a web app that accepts itemized receipts, assigns consumption per person, and automatically simplifies who pays whom.

## What Changes

- Build a new Next.js full-stack web app (TypeScript) for event-based expense splitting.
- Event creation with named participants and an unguessable shareable link; anyone with the link can view and edit (no accounts in v1).
- Expense entry with itemized receipts: line items (name, amount), tax, tip, total; each line item assigned to one or more participants.
- Three split modes per expense: `itemized` (per-line assignment), `even` (whole expense divided equally), `group` ("birthday mode" — all items split across everyone regardless of assignment).
- Tax and tip allocated proportionally to each participant's pre-tax subtotal, computed automatically.
- Derived net balances per participant and a simplified settlement view using greedy min-cash-flow.
- Validation that line items + tax + tip reconcile to the expense total, with warnings on mismatch.

## Capabilities

### New Capabilities
- `events`: Creating events with participants and sharing them via unguessable links; access semantics for link holders.
- `expenses`: Itemized receipt entry, split modes, tax/tip allocation, and reconciliation validation.
- `balances`: Net balance derivation and simplified settlement computation.

### Modified Capabilities

(none — greenfield change)

## Impact

- New codebase: Next.js App Router project with TypeScript, Drizzle ORM + SQLite/Postgres.
- No existing code, APIs, or systems are affected (greenfield).
- Future changes assumed compatible: attaching user accounts later will link users to participants without changing ledger math; OCR and multi-currency deferred by design.
