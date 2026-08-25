## 1. Scaffold

- [x] 1.1 Add `deleteEventAction` server action in `src/lib/actions.ts` and verify it types correctly
- [x] 1.2 Add delete button and confirmation UI in `src/app/e/[token]/page.tsx` visible only to owner

## 2. Delete Action

- [x] 2.1 Implement `deleteEventAction(token: string)` in `src/lib/actions.ts`:
  - Verify owner session (`requireSession` + `ownerId === viewer.id`)
  - Delete event row with ordered deletes: expenses → participants → event (`expenses.payerId` is RESTRICT; bare cascade fails)
  - Revalidate `/tabs` and `/`
  - Redirect to `/tabs`
- [x] 2.2 Test delete action with integration test: create event, delete as owner, verify cascade (`delete-event.integration.test.ts`, 3 tests passing)

## 3. Delete UI

- [x] 3.1 Add delete button in event header, visible only to owner
- [x] 3.2 Implement confirmation dialog with "Are you sure?" message showing event name
- [x] 3.3 On confirm, call `deleteEventAction` and show success state
- [x] 3.4 Handle non-owner access: redirect with error if non-owner attempts deletion
- [ ] 3.5 After deletion, share link `/e/<token>` shows "event deleted" state — PARTIAL: plain visits get generic 404; distinguishing deleted from never-existed needs a tombstone or spec amendment

## 4. Integration Tests

- [x] 4.1 Run full test suite; ensure no regressions (43 passed; same 2 pre-existing failures as before this change)
- [x] 4.2 Verify delete flow end-to-end: create → delete as owner → verify cascade and share link invalidation
- [x] 4.3 Verify non-owner cannot delete event