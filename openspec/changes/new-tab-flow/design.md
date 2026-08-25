## Context

Event creation currently occurs on the home page inline. This design introduces a dedicated `/create` page with a Typeform-style step-by-step flow, isolating the creation experience and reducing cognitive load. The existing share token generation and balance math remain unchanged.

## Goals / Non-Goals

**Goals:**

- Provide a dedicated `/create` page for event creation
- Implement a Typeform-style progressive form (step 1: event name, step 2: participants, step 3: confirmation)
- Maintain compatibility with existing event data model and share token flow
- Keep all ledger math and balance derivation unchanged

**Non-Goals:**

- Redesigning the entire event dashboard
- Adding user accounts or authentication
- Modifying the expense splitting logic
- Changing the share token format or access semantics

## Decisions

### D1: New page at `/create`

- A new App Router page at `src/app/create/page.tsx` hosts the Typeform flow
- Uses server component for initial form state, client component for step navigation
- Preserves existing `/e/[token]` event access pattern

### D2: Typeform-style form steps

- **Step 1**: Event name input → validate unique name, proceed to participants
- **Step 2**: Participant names (comma-separated or one-per-line) → validate ≥2 participants, proceed to confirmation
- **Step 3**: Confirmation summary → create event with share token, redirect to event page

### D3: Form state management

- Minimal server session; share token generated upon final confirmation
- Validation errors displayed inline; progress saved per step
- Back button navigates to previous step; data persists within the session

### D4: Integration with existing code

- Calls existing event creation logic (share token via nanoid) on form submit
- No changes to `src/lib/ledger.ts` or balance computation
- Existing expense entry flow unaffected

## Risks / Trade-offs

- [Anyone with the share link can edit] → Accepted v1 trade-off, documented in existing spec; accounts change will add identity later
- [Form data loss on browser close] → Not persisted server-side; user must complete flow in one session
- [Step 2 participant list too long] → Cap at 10 participants for usability; increase if needed later

## Migration Plan

Initial schema migration not required (no data model changes). Deploy the `/create` page alongside existing home page; redirect home page create button to new page after design is verified.

## Open Questions

None blocking — remaining choices (exact UI library, styling approach) are implementation-level and deferred to tasks.
