## MODIFIED Requirements

### Requirement: Group-aware net balance derivation

The system SHALL compute `paid − consumed` for each participant, using `expense_shares` to resolve participant sets and weights, with live group resolution.

#### Scenario: Single group expense contributes to balances

- **WHEN** an expense has `expense_shares` rows referencing group "Car A" (Alice, Bob), total $30, equal shares
- **AND** no other expenses in the event
- **THEN** Alice net: +$10, Bob net: +$10, other event participants net: $0
- **AND** balances sum to zero

#### Scenario: Live group membership change updates past balances

- **WHEN** an expense references group "Car A" (Alice, Bob), total $30, even split
- **AND** later Carol is added to "Car A"
- **THEN** recomputing balances includes Carol: Alice +$10, Bob +$10, Carol +$10

#### Scenario: Mixed share types in one expense

- **WHEN** an "As a total" expense has Alice (equal), Bob (60%), Carol ($40.56)
- **THEN** consumption computed from each participant's share type; total consumption equals expense total

#### Scenario: Itemized expense with line-level shares

- **WHEN** an itemized expense has line item A shared by Alice+Bob, line item B by Carol
- **THEN** Alice and Bob consume from A only; Carol consumes from B only; tax/tip allocated by pre-tax subtotals

### Requirement: Simplify debts with share-scoped balances

The system SHALL apply the greedy min-cash-flow simplification to balances derived from `expense_shares`.

#### Scenario: Simplify after even expense with custom shares

- **WHEN** net balances after expense: Alice +$30, Bob −$18, Carol −$12
- **THEN** simplification produces transfers: Bob pays Alice $18, Carol pays Alice $12

#### Scenario: Multiple debts after mixed expenses

- **WHEN** net balances are: Alice +$20, Bob +$10, Carol −$15, Dave −$25
- **THEN** greedy simplification minimizes transfers as with existing simplifyDebts behavior