## 1. Scaffold

- [ ] 1.1 Create `src/app/create/page.tsx` page structure and verify `npm run dev` serves the page
- [ ] 1.2 Add Typeform-style form CSS/spacing using design tokens from `src/app/globals.css`

## 2. Form Step 1: Event Name

- [ ] 2.1 Implement event name input field with validation (non-empty, reasonable length)
- [ ] 2.2 Add "Next" button to proceed to participant entry; verify name is stored in form state

## 3. Form Step 2: Participants

- [ ] 3.1 Implement participant name input (comma-separated or one-per-line)
- [ ] 3.2 Add validation for ≥2 participants; add "Back" and "Next" buttons

## 4. Form Step 3: Confirmation

- [ ] 4.1 Render summary of event name and participant count
- [ ] 4.2 On submit, invoke existing event creation logic to generate share token
- [ ] 4.3 Redirect to event page at `/e/<token>`; verify share link works

## 5. Integration

- [ ] 5.1 Verify form submit integrates with nanoid share token generation
- [ ] 5.2 Confirm no changes to ledger math or balance derivation
- [ ] 5.3 Run full test suite; ensure no regressions
