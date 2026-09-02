## Purpose

Unified weight storage and computation for both line-item and whole-expense splits. Replaces the `evenParticipantIds` array and `group` split mode with a single `expense_shares` table that stores per-participant weights (`equal` | `percent` | `amount`) at either the line-item level or the expense-total level.

## ADDED Requirements

### Requirement: Expense shares storage

The system SHALL store split weights for each expense in an `expense_shares` table, with one row per participant per scope (line item or whole expense).

#### Scenario: Save expense with equal shares at total level

- **WHEN** a link holder creates an "As a total" expense for 4 participants with equal split
- **THEN** 4 rows are inserted into `expense_shares` with `lineItemId = NULL`, `weightType = 'equal'`, `weightValue = 10000`

#### Scenario: Save expense with percent shares at total level

- **WHEN** a link holder creates an "As a total" expense with custom percentages (Alice 60%, Bob 40%)
- **THEN** 2 rows are inserted with `weightType = 'percent'`, `weightValue = 6000` and `4000` (basis points)

#### Scenario: Save expense with amount shares at total level

- **WHEN** a link holder creates an "As a total" expense with exact amounts (Alice $40, Bob $20.56)
- **THEN** 2 rows are inserted with `weightType = 'amount'`, `weightValue = 4000` and `2056` (cents)

#### Scenario: Save itemized expense with line-level shares

- **WHEN** a link holder creates a "By items" expense with 2 line items, each assigned to different participants
- **THEN** rows are inserted with `lineItemId` set to each line item's ID, `weightType = 'equal'`

### Requirement: Weight types and validation

The system SHALL validate that shares are internally consistent.

#### Scenario: Percent shares must sum to 100%

- **WHEN** saving an expense with `weightType = 'percent'` shares
- **THEN** the sum of `weightValue` across all shares for that scope MUST equal 10000 basis points
- **AND** if not, the save is rejected with an error

#### Scenario: Amount shares must sum to expense total

- **WHEN** saving an expense with `weightType = 'amount'` shares at total level
- **THEN** the sum of `weightValue` MUST equal the expense `totalCents`
- **AND** if not, the save is rejected with an error

#### Scenario: Equal shares require no validation beyond participant count

- **WHEN** saving an expense with `weightType = 'equal'` shares
- **THEN** `weightValue` MUST be 10000 for all participants in that scope

### Requirement: Ledger computation from shares

The system SHALL compute consumption using `expense_shares` as the single source of truth for participant sets and weights.

#### Scenario: Equal shares at total level divide total equally

- **WHEN** an expense has `totalCents = 9000` and 3 `expense_shares` rows with `weightType = 'equal'`, `lineItemId = NULL`
- **THEN** each participant's consumed share is 3000 cents

#### Scenario: Percent shares divide proportionally

- **WHEN** an expense has `totalCents = 9000` and shares with weights 6000 and 4000 basis points
- **THEN** consumed shares are 5400 and 3600 cents (largest-remainder rounding)

#### Scenario: Amount shares assign exact cents

- **WHEN** an expense has shares with `weightType = 'amount'` values 4000 and 2056
- **THEN** consumed shares are exactly 4000 and 2056 cents (remainder cents absorbed by last participant)

#### Scenario: Line-item shares only affect assigned line items

- **WHEN** an itemized expense has line item A with shares for Alice+Bob, and line item B with shares for Carol
- **THEN** Alice and Bob consume from line item A only; Carol consumes from line item B only

### Requirement: Tax and tip allocation with shares

The system SHALL allocate tax and tip proportionally to each participant's pre-tax subtotal within the resolved participant set for that scope.

#### Scenario: Tax allocated by subtotal weights at total level

- **WHEN** an "As a total" expense has tax $900 and two participants with pre-tax weights 60% / 40%
- **THEN** tax allocated $540 and $360 (largest-remainder)

#### Scenario: Tax allocated by line-item weights

- **WHEN** an itemized expense has line items with different participant weights
- **THEN** tax/tip allocated proportionally to each participant's pre-tax subtotal across all line items

## REMOVED Requirements

### Requirement: evenParticipantIds array on expense

**Reason**: Replaced by `expense_shares` with `weightType = 'equal'` at expense level (`lineItemId = NULL`)

**Migration**: Existing `even` expenses migrate to shares with equal weight

### Requirement: splitMode "group" enum value

**Reason**: "Group" mode was "everyone equal" — now expressed as "As a total" with all participants selected and equal shares

**Migration**: Existing `group` expenses migrate to `even` splitMode with shares for all participants
