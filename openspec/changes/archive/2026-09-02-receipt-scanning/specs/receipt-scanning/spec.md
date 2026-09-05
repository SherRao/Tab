## Purpose

Lets users photograph a paper receipt and have the app draft the expense automatically. OCR runs entirely in the browser; the photo is never uploaded. Scanned output is always an editable draft that the user reviews before saving.

## ADDED Requirements

### Requirement: Receipt capture

The system SHALL let the user provide a receipt photo from the device camera (on mobile) or from the file system, from within the new-expense flow.

#### Scenario: Capture with camera

- **WHEN** a user on a mobile device taps "Scan receipt" and takes a photo
- **THEN** the photo is used as the scan input without leaving the page

#### Scenario: Upload an existing photo

- **WHEN** a user selects an image file from their device
- **THEN** the selected image is used as the scan input

#### Scenario: Manual entry remains available

- **WHEN** a user opens the new-expense flow
- **THEN** they can enter the expense manually without scanning

### Requirement: On-device OCR

The system SHALL perform OCR entirely in the browser. Receipt images SHALL NOT be uploaded to any server or persisted by the app.

#### Scenario: Image stays local

- **WHEN** a receipt is scanned
- **THEN** no image data is sent to the server, and the image is discarded when the user leaves the scan screen

#### Scenario: OCR progress feedback

- **WHEN** OCR is running
- **THEN** the UI shows a progress indication until parsing completes or fails

### Requirement: Parse into expense draft

The system SHALL parse OCR output into a draft containing line items (name and amount), tax amount, tip amount, and total, using amount and keyword heuristics (e.g., lines labeled "tax", "tip", "total"/"balance due").

#### Scenario: Clean receipt parses fully

- **WHEN** a legible receipt with item lines, tax, tip, and a grand total is scanned
- **THEN** the draft contains the item names and amounts, tax, tip, and total from the receipt

#### Scenario: Keyword classification

- **WHEN** a recognized line is labeled "tax", "tip"/"gratuity", or "total"/"balance due"
- **THEN** its amount is classified as tax, tip, or total respectively and not as a line item

### Requirement: Review before save

The system SHALL pre-fill the expense editor with the parsed draft as an editable suggestion. The system SHALL NOT save the expense without the user reviewing and explicitly saving.

#### Scenario: Draft pre-fills the editor

- **WHEN** parsing completes successfully
- **THEN** the expense editor opens with line items, tax, tip, and total pre-filled, and the user can modify or delete any value before saving

#### Scenario: Payer still chosen by user

- **WHEN** a scanned draft is loaded into the editor
- **THEN** the payer field starts empty (or as previously selected) and must be chosen by the user

### Requirement: Graceful failure and fallback

The system SHALL show a clear message and route the user to manual entry when scanning fails or produces no usable draft.

#### Scenario: Unreadable image

- **WHEN** OCR yields no recognizable item lines or total
- **THEN** the system shows a message that the receipt could not be read and offers manual entry, preserving any partially recognized values in the editor

#### Scenario: Reconciliation still applies

- **WHEN** a scanned draft is saved with mismatched items + tax + tip vs total
- **THEN** the existing non-blocking reconciliation warning is shown, identical to manual entry

### Requirement: Scan retries

The system SHALL let the user re-scan or choose a different photo after a failed or unsatisfactory scan without losing the rest of the expense flow.

#### Scenario: Retake after bad scan

- **WHEN** the user chooses to re-scan after an unsatisfactory result
- **THEN** the scan input resets and a new photo can be taken or selected
