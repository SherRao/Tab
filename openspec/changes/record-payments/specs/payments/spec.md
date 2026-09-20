## Purpose

Lets participants record direct participant-to-participant payments on an event so the ledger reflects money that has actually changed hands, not just what the settle-up view suggests.

## ADDED Requirements

### Requirement: Record a payment

The system SHALL allow the paying participant to record a payment on an event, capturing the sender, recipient, amount in integer cents, an optional short note, and a creation timestamp. The amount MAY be any positive value, including one that does not exactly match a suggested transfer.

#### Scenario: Free-form payment

- **WHEN** the payer opens "Record a payment", picks a recipient in the event, and enters an amount
- **THEN** the payment is saved to the event and appears immediately in balances and payment history

#### Scenario: Mark a suggested transfer as paid

- **WHEN** the payer taps "Mark as paid" on a suggested settle-up row
- **THEN** a payment form opens pre-filled with the suggested recipient and amount, editable before save

#### Scenario: Partial payment

- **WHEN** the suggested settlement is B pays A $30 and B records a $20 payment
- **THEN** the payment is saved and the suggested settlement recomputes to B pays A $10

#### Scenario: Overpayment

- **WHEN** B records a $50 payment to A while owing only $30
- **THEN** the payment is saved and the suggested settlement now shows A owing B $20

### Requirement: Only the payer can log a payment

The system SHALL restrict creating, editing, and deleting a payment to a viewer signed in with a session whose user has an approved claim on the "from" participant. Any other viewer, including anonymous share-link viewers and users claimed to a different participant, SHALL NOT be able to write payment records.

#### Scenario: Unclaimed guest attempts to record a payment

- **WHEN** an anonymous viewer or a signed-in user with no approved claim on any participant opens the payment editor
- **THEN** the editor prompts them to sign in and claim their participant before they can save

#### Scenario: Viewer claimed to a different participant

- **WHEN** a viewer claimed to participant C submits a payment with "from" set to participant B
- **THEN** the server rejects the write and no payment record is created

#### Scenario: Payer edits or deletes their own payment

- **WHEN** the viewer is claimed to the payment's "from" participant
- **THEN** they can edit the amount, note, or recipient, or delete the record

#### Scenario: Non-payer cannot edit

- **WHEN** a viewer not claimed to the payment's "from" participant attempts to edit or delete it
- **THEN** the server rejects the write

### Requirement: Payments update balances immediately without receiver confirmation

The system SHALL apply a saved payment to the ledger the moment it is written, with no pending or approval state. Editing or deleting a payment SHALL update balances the same way.

#### Scenario: Immediate application

- **WHEN** a payment is saved
- **THEN** every participant's net balance and the simplified settlement reflect it on the next page load or revalidation, with no intermediate "pending" state visible to the recipient

#### Scenario: Deletion reverses effect

- **WHEN** the payer deletes a previously recorded payment
- **THEN** balances return to what they would have been without that payment

### Requirement: Payment history is visible on the event page

The system SHALL display a chronological payment history for the event inline under the settle-up section, showing sender, recipient, amount, note when present, and creation time. Each row belonging to the current viewer SHALL expose edit and delete affordances.

#### Scenario: Viewing history

- **WHEN** any viewer opens the event page
- **THEN** they see the list of recorded payments for that event alongside the settle-up suggestions

#### Scenario: Empty history

- **WHEN** no payments have been recorded
- **THEN** the history section is either hidden or shows an empty state without affecting the rest of the page

