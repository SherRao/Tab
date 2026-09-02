## MODIFIED Requirements

### Requirement: Split modes

The system SHALL support two split modes per expense: `itemized` (per-line-item assignment) and `even` (entire expense including tax and tip divided among chosen participants according to their shares).

#### Scenario: Even mode uses shares for division

- **WHEN** an expense uses `splitMode: "even"` with 3 participants having shares (equal / 60% / $40)
- **THEN** each participant's consumption is computed from their `expense_shares` row, not from a participant ID array

#### Scenario: Itemized mode uses line-item shares

- **WHEN** an expense uses `splitMode: "itemized"` with multiple line items
- **THEN** each line item's consumption is computed from `expense_shares` rows where `lineItemId` matches that line item

#### Scenario: Group mode removed

- **WHEN** an expense previously used `splitMode: "group"`
- **THEN** it is migrated to `splitMode: "even"` with shares for all event participants at equal weight

### Requirement: Tax and tip allocation

For both `itemized` and `even` modes, the system SHALL allocate tax and tip proportionally to each participant's pre-tax subtotal, computed from their shares.

#### Scenario: Tax allocated by share weights in even mode

- **WHEN** an even expense has tax $900 and participants with pre-tax shares 60% / 40%
- **THEN** tax allocated $540 and $360 (largest-remainder)

### Requirement: Total reconciliation

The system SHALL compare the sum of line items plus tax plus tip against the entered total and warn when they do not match.

#### Scenario: Totals match with shares

- **WHEN** line items ($3200) + tax ($256) + tip ($600) = entered total ($4056)
- **THEN** the expense saves without warnings

#### Scenario: Totals mismatch with shares

- **WHEN** line items + tax + tip differ from the entered total by a non-zero amount
- **THEN** the system displays a warning showing the discrepancy; the user may still save

### Requirement: Expense editing and deletion

The system SHALL allow any link holder to edit or delete an expense; balances SHALL reflect the change immediately.

#### Scenario: Edit expense updates shares

- **WHEN** a link holder edits an expense and changes participant shares
- **THEN** `expense_shares` rows are replaced with new values and balances recompute