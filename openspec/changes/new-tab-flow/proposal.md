## Why

Creating events currently happens on the home page, mixing landing marketing with form entry. A dedicated flow isolates the event creation experience and allows for a step-by-step Typeform-style progression that reduces cognitive load and improves completion rates.

## What Changes

- Move event creation from the home page to a dedicated `/create` page
- Implement a Typeform-style step-by-step form for event creation
- Maintain existing share token link access semantics

## Capabilities

### New Capabilities

- `event-creation`: A dedicated, Typeform-style step-by-step form for creating new events, separate from the home page. Covers event name input, participant addition, and share token generation.

### Modified Capabilities

(empty)

## Impact

- UI: New `/create` page replacing inline home page form
- No API changes; share token generation logic unchanged
- Existing event data and balances unaffected