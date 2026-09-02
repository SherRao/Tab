## 1. Update participant input type and state

- [x] 1.1 Add `email?: string` to the `guest` variant of `AddParticipantInput` in `src/lib/participants.ts`
- [x] 1.2 Update `addParticipant` so guest mode validates a provided email (existing format regex + `assertEmailFreeInEvent`) and stores `{ eventId, name, email }` WITHOUT setting `invitedAt`
- [x] 1.3 Update `participantState` to return "invited" only when `email != null && invitedAt != null`, so a guest-with-email reads as "guest"
- [ ] Verify: `npm test` — existing participant creation, invite, and claim tests still pass

## 2. Update database query record

- [x] 2.1 Update `addParticipantRecord` in `src/lib/queries.ts` to store a guest email (trimmed/lowercased) without setting `invitedAt`
- [ ] Verify: create flow stores guest email and leaves `invitedAt` null

## 3. Update search chooser input parsing

- [x] 3.1 In `src/components/people/search-chooser.tsx`, add `email?: string` to the `guest` variant of `EntryChoice`
- [x] 3.2 Update `buildChoices` to detect `Name email@domain.com`, offering a guest-with-email choice; keep bare `email@domain.com` as invite mode and name-only as plain guest
- [ ] Verify: typing "John john@example.com" offers guest-with-email; "john@example.com" offers invite; "John" offers plain guest

## 4. Update people input display

- [x] 4.1 Update `src/components/people/create-event-people-input.tsx` chips to show the guest email when present, keeping the "no account" badge
- [ ] Verify: chip for a guest-with-email displays name + email with a "no account" badge

## 5. Keep guests-with-email off the invitation path

- [x] 5.1 Update `createEventAction`'s invitation loop to require `person.invitedAt != null` before sending an email (not just `person.email != null`)
- [x] 5.2 Update `addParticipantAction` to forward an optional guest `email` when constructing `AddParticipantInput`
- [x] 5.3 Confirm `addParticipantAction`'s send condition already requires `row.email != null && row.invitedAt != null`
- [ ] Verify: adding a guest with email via the create flow and via the event-page add flow sends no invitation email

## 6. Add integration test coverage

- [x] 6.1 Extend `src/lib/__tests__/accounts-flow.integration.test.ts` (mock `sendEmail` from `@/lib/email` where needed): a guest-with-email through `createEventRecord` stores email and leaves `invitedAt` null
- [x] 6.2 Add a test that `addParticipantAction` with a guest+email entry stores the email and sends no email
- [x] Verify: `npm test` passes