## Purpose

Derives net balances per participant, supporting group-scoped expense assignment. Balances always sum to zero within the event context.

## ADDED Requirements

### Requirement: Group-aware net balance derivation

The system SHALL compute `paid − consumed` for each participant, using only participants across selected groups when `groupIds` is set on any expense.

#### Scenario: Single group expense contributes to balances

- **WHEN** an expense has `groupIds: [Group A]` (Alice, Bob, Carol), total $30, even split
- **AND** no other expenses in the event
- **THEN** Alice net: +$10 (paid $0, consumed $10), Bob net: +$10, Carol net: +$10, other event participants net: $0
- **AND** balances sum to zero within the group context

#### Scenario: Multiple group expense contributes to balances

- **WHEN** an expense has `groupIds: [Group A, Group B]` (Alice, Bob from Group A; Carol, Dave, Eve from Group B), total $50, even split
- **THEN** each of the 5 unique members owes $10; Alice net: +$10, Bob net: +$10, Carol net: +$10, Dave net: +$10, Eve net: +$10
- **No duplicate allocation** — each participant counted once even if groups overlap in membership

#### Scenario: Group expense mixed with itemized expenses

- **WHEN** event has one expense with `groupIds: [Group A]` (even split) and another expense with `splitMode: "itemized"` (no groups)
- **THEN** the group expense only affects its group's participants; the itemized expense affects its assigned participants; balances from both are combined, still sum to zero

#### Scenario: Group expense with prior participants added later

- **WHEN** a participant is added to an event after group-assigned expenses exist
- **THEN** the new participant has $0 contribution to past group expenses (their balance is computed only from expenses recorded after they were added), consistent with existing participant addition semantics

### Requirement: Simplify debts with group-scoped balances

The system SHALL apply the greedy min-cash-flow simplification to group-scoped balances.

#### Scenario: Simplify after group expense

- **WHEN** net balances after group-inclusive expenses are: Alice +$30, Bob −$30
- **THEN** simplification produces one transfer: Bob pays Alice $30

#### Scenario: Multiple debts after group expenses

- **WHEN** net balances are: Alice +$20, Bob +$10, Carol −$15, Dave −$25
- **THEN** greedy simplification: Dave pays Alice $25 (now Alice +$45, Bob +$10, Carol −$15), then Bob pays Carol $15 (now Alice +$45, Bob −$5, Dave −$25... continues until all settled)
- **Minimizes transfers** as with existing simplifyDebts behavior