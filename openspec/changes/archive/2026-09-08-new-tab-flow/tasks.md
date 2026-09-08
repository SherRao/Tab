## 1. Scaffold

- [x] 1.1 Create `src/app/(app)/create/page.tsx` (routed under the `(app)` group so it picks up the shared site header) and verify `npm run dev` serves the page
- [x] 1.2 Add step-form CSS/spacing using design tokens from `src/app/globals.css` (`paper-card`, `receipt-edge`, `input-ink`, `btn-ink`, `chip`, `form-step`, `rise-in`)
- [x] 1.3 Extract the client-side step machine into `src/components/create-tab-form.tsx`; the page stays a server component that resolves the viewer and passes `createEventAction`

## 2. Form Step 1: Tab name

- [x] 2.1 Implement the name input with non-empty validation via the exported `canContinueToPeople` helper; add suggestion chips (Dinner / Weekend trip / Apartment / Bachelorette)
- [x] 2.2 Add "Continue →" to proceed to people entry; verify the name is held in form state and replayed as a hidden field on submit

## 3. Form Step 2: People

- [x] 3.1 Reuse `CreateEventPeopleInput` for people entry (account search, guest, and invite-by-email entries) rather than a free-text list
- [x] 3.2 Require at least one other person (viewer + 1 = 2 participants); disable submit until then and add a "← Back" control to step 1

## 4. Submit

- [x] 4.1 Show a live summary on step 2 ("You + N others = N+1 people") instead of a separate confirmation step — the flow is 2 steps, not the 3 sketched in `design.md`
- [x] 4.2 On submit, invoke `createEventAction` to generate the share token; show the `tab open ✓` stamp during the pending window
- [x] 4.3 Redirect to `/e/<token>`, where the existing `copy-link-button` surfaces the share link; verify the link works

## 5. Integration

- [x] 5.1 Verify submit integrates with nanoid share token generation (`createEventAction`, `src/lib/actions.ts:89`) and that failures bounce back to `/create?error=1` with an inline `ErrorNote`
- [x] 5.2 Gate the page on a signed-in viewer, redirecting to `/signin?next=%2Fcreate` — accounts landed after this change was drafted, so the original "no auth" non-goal no longer holds
- [x] 5.3 Point the landing page, how-it-works section, and `/tabs` empty state at `/create`; remove the inline create form from `src/app/page.tsx` so it is marketing only
- [x] 5.4 Confirm no changes to ledger math or balance derivation
- [x] 5.5 Add a unit test for `canContinueToPeople` (`src/components/create-tab-form.test.ts`); run the full suite and confirm no regressions
