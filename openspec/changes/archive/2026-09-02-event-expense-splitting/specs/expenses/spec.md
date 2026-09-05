## Purpose

Defines how expenses are entered as itemized receipts and how consumption is assigned to participants. Supports three split modes (itemized, even, group), proportional tax/tip allocation, and reconciliation validation against the receipt total.

## ADDED Requirements

### Requirement: Expense entry with line items

The system SHALL allow recording an expense with a payer, one or more named line items each with an amount, plus tax amount, tip amount, and total.

#### Scenario: Record itemized lunch

- **WHEN** a link holder records an expense with payer "A", line items ("Tacos" $24, "Guacamole" $8), tax $2.56, tip $6, total $40.56
- **THEN** the expense is stored with all line items and amounts and appears in the event's expense list

### Requirement: Line item assignment

The system SHALL allow each line item to be assigned to one or more participants who consumed it, with the item's cost divided equally among assignees.

#### Scenario: Shared appetizer

- **WHEN** a $30 line item is assigned to participants A and B
- **THEN** each is charged $15 of that item's pre-tax cost

#### Scenario: Unassigned line item

- **WHEN** an expense in itemized mode contains a line item with no assignees
- **THEN** the system warns that the item is unassigned before the expense can be considered fully allocated

### Requirement: Split modes

The system SHALL support three split modes per expense: `itemized` (per-line-item assignment), `even` (entire expense including tax and tip divided equally among chosen participants), and `group` (all line items treated as shared by all event participants regardless of per-item assignments).

#### Scenario: Even mode ignores line items

- **WHEN** an expense uses `even` mode for 3 participants with total $90
- **THEN** each participant's consumption is exactly $30

#### Scenario: Birthday group mode

- **WHEN** an expense uses `group` mode at an event with 5 participants
- **THEN** every participant's consumption equals their equal share of the entire expense total, regardless of any line-item assignments

### Requirement: Tax and tip allocation

For `itemized` and `group` modes, the system SHALL allocate tax and tip proportionally to each participant's pre-tax subtotal of consumed items, computed automatically without per-item tax entry.

#### Scenario: Proportional allocation

- **WHEN** A consumed $60 pre-tax and B consumed $30 pre-tax on an expense with $9 tax
- **THEN** A is allocated $6 of tax and B is allocated $3

### Requirement: Total reconciliation

The system SHALL compare the sum of line items plus tax plus tip against the entered total and warn when they do not match.

#### Scenario: Totals match

- **WHEN** line items ($32) + tax ($2.56) + tip ($6) = entered total ($40.56)
- **THEN** the expense saves without warnings

#### Scenario: Totals mismatch

- **WHEN** line items + tax + tip differ from the entered total by a non-zero amount
- **THEN** the system displays a warning showing the discrepancy; the user may still save

### Requirement: Expense editing and deletion

The system SHALL allow any link holder to edit or delete an expense; balances SHALL reflect the change immediately.

#### Scenario: Delete an expense

- **WHEN** a link holder deletes an expense
- **THEN** it no longer appears in the event and balances are recomputed without it
