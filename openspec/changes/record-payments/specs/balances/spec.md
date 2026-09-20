## MODIFIED Requirements

### Requirement: Net balance derivation

The system SHALL compute each participant's net balance as total paid on expenses minus total consumed, plus payments sent minus payments received, where consumed includes allocated line-item costs plus proportional tax and tip. Net balances SHALL be derived from stored facts on demand, never stored as authoritative data.

#### Scenario: Single expense balance

- **WHEN** A paid $90 for lunch and dinner, consuming $40 of it, and no other expenses or payments exist
- **THEN** A's net balance is +$50

#### Scenario: Balances sum to zero

- **WHEN** any set of expenses and payments exists with no rounding error beyond one cent per allocation
- **THEN** the sum of all participants' net balances equals zero (within one cent)

#### Scenario: Recompute after change

- **WHEN** an expense or payment is added, edited, or deleted
- **THEN** balances and settlements reflect the change immediately

#### Scenario: Payment reduces debt

- **WHEN** A's net is +$30 and B's net is -$30, and B records a $30 payment to A
- **THEN** both nets are $0 and the settle-up view shows no suggested transfers
