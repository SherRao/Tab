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

## Outcome (as built)

The flow shipped with four deviations from the decisions above. They are recorded
here rather than edited into D1–D4 so the original reasoning stays readable.

- **Two steps, not three (D2).** The confirmation step was dropped. Step 2 shows a
  live "You + N others = N+1 people" summary and a `tab open ✓` stamp while the
  action is pending, which covers the same reassurance without an extra tap.
- **Route is `src/app/(app)/create/page.tsx` (D1).** It sits in the `(app)` route
  group so it inherits the shared site header.
- **The page requires a signed-in viewer.** The "no accounts or authentication"
  non-goal was overtaken by the accounts change; unauthenticated visitors are sent
  to `/signin?next=%2Fcreate`.
- **People are added through `CreateEventPeopleInput`, not a comma-separated
  field (D2).** That control already handles account search, guests, and
  invite-by-email, so the 10-participant usability cap was never needed.
