## Purpose

Derives each participant's net balance from recorded expenses and presents a simplified settlement — the minimum set of transfers that clears all debts.

## ADDED Requirements

### Requirement: Net balance derivation

The system SHALL compute each participant's net balance as total paid minus total consumed, where consumed includes allocated line-item costs plus proportional tax and tip. Net balances SHALL be derived from stored facts on demand, never stored as authoritative data.

#### Scenario: Single expense balance

- **WHEN** A paid $90 for lunch and dinner, consuming $40 of it, and no other expenses exist
- **THEN** A's net balance is +$50

#### Scenario: Balances sum to zero

- **WHEN** any set of expenses exists with no rounding error beyond one cent per allocation
- **THEN** the sum of all participants' net balances equals zero (within one cent)

#### Scenario: Recompute after change

- **WHEN** an expense is added, edited, or deleted
- **THEN** balances and settlements reflect the change immediately

### Requirement: Debt simplification

The system SHALL present a simplified settlement using greedy min-cash-flow (repeatedly matching the largest creditor against the largest debtor), producing at most n−1 transfers where n is the number of participants with non-zero balances.

#### Scenario: Chain cancellation

- **WHEN** A owes B $10 and B owes C $10
- **THEN** the settlement shows a single transfer: A pays C $10

#### Scenario: Multiple debts collapse

- **WHEN** A owes B $10, C owes B $15, and D owes B $5 at an event
- **THEN** the settlement shows three transfers directly to B and B owes nothing to anyone

#### Scenario: Settled event

- **WHEN** every participant's net balance is zero
- **THEN** the settlement view shows "all settled" with no transfers
