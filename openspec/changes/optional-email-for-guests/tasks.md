## 1. Update participant input type

- [ ] 1.1 Add optional `email?: string` to `AddParticipantInput` for guest mode in `src/lib/participants.ts`
- [ ] 1.2 Update `addParticipant` function to store email + `invitedAt` when guest mode has email
- [ ] 1.3 Update `linkAccountToParticipant` to preserve email when linking account to guest-with-email
- [ ] Verify: Run existing tests to ensure participant creation and account linking still works

## 2. Update database query record

- [ ] 2.1 Update `addParticipantRecord` in `src/lib/queries.ts` to mirror guest+email storage logic
- [ ] Verify: Confirm participant record creation with email works correctly

## 3. Update search chooser input parsing

- [ ] 3.1 Modify `buildChoices` in `src/components/people/search-chooser.tsx` to parse `Name email@domain.com` as guest-with-email mode
- [ ] 3.2 Ensure `email@domain.com` only still offers invite mode
- [ ] 3.3 Update `EntryChoice` type if needed to include email for guest mode
- [ ] Verify: Test that typing "John john@example.com" offers guest-with-email, while "john@example.com" offers invite

## 4. Update people input display

- [ ] 4.1 Update `MODE_BADGE` and entry display in `src/components/people/create-event-people-input.tsx` to show email badge for guest entries when present
- [ ] Verify: Confirm email shows in participant list badges when a guest with email is added

## 5. Verify email invitation flow unchanged

- [ ] 5.1 Confirm `createEventAction` email loop guards with `person.email == null` (guest+email won't trigger invites)
- [ ] 5.2 Confirm `addParticipantAction` email loop guards with `row.email != null && row.invitedAt != null`
- [ ] Verify: No invitation emails sent when adding guest with email