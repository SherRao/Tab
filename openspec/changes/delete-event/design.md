## Context

Event creation currently occurs via the home page form or the `/create` dedicated page. This design introduces permanent deletion of events by their creator. The event owner can delete a tab permanently, which cascades to all dependent data (participants, expenses, line items, share shares). The share link becomes invalid immediately after deletion.

The existing `ownerId` on the events table identifies the creator. SQLite foreign keys with `onDelete: "cascade"` handle automatic cleanup of participants, expenses, line items, and share shares.

## Goals / Non-Goals

**Goals:**

- Allow event owner to permanently delete their event from the event page
- Cascade deletion to all dependent data (participants, expenses, line items, share shares) via SQLite foreign keys
- Invalidate the share link immediately after deletion
- Show "event deleted" state to visitors of the share link
- Provide confirmation before permanent action

**Non-Goals:**

- Soft-delete or restore functionality (future change)
- Group-aware deletion (future change)
- Recovering deleted events (future change)
- Modifying the expense splitting logic
- Adding user accounts or authentication

## Decisions

### D1: Permanent DB Deletion via Cascading Foreign Keys

- Delete event row with `DELETE FROM events WHERE shareToken = ?`
- SQLite `onDelete: "cascade"` automatically removes: participants → participantClaims, expenses → lineItems → lineItemShares
- No manual deletes required in the action
- Trade-off: Data cannot be easily recovered; user must confirm before deleting

### D2: Owner-Gated Deletion

- Delete action requires `viewer.id === event.ownerId` check
- Non-owners are redirected back to the event page with an error
- Trade-off: Only the creator has this power; organizers without ownership cannot clean up

### D3: Share Link Invalidation

- After event deletion, the share token becomes invalid
- Visitors to `/e/<token>` see "This event has been deleted" message
- Owner is redirected to `/tabs` with success toast
- Trade-off: Any ongoing sessions using the link are instantly broken

### D4: Confirmation Dialog

- Modal confirmation before permanent deletion
- Shows event name and warns "This cannot be undone"
- Two buttons: "Cancel" and "Delete [event name]"
- Trade-off: Extra click, but prevents accidental deletion

## Risks / Trade-offs

- **[Permanent data loss]** → Accepted; user confirms before deletion. Export data manually before deleting if needed.
- **[Accidental deletion]** → Mitigated by confirmation dialog with explicit warning
- **[Broken share links]** → Inevitable with permanent deletion; users informed via "event deleted" state
- **[Non-owner deletion]** → Mitigated by ownerId check; only creator can delete

## Migration Plan

1. Add `deleteEventAction` in `src/lib/actions.ts`
2. Add delete button and confirmation in `src/app/e/[token]/page.tsx`
3. Test with integration tests
4. Deploy alongside existing event page; no breaking API changes

## Open Questions

- Should there be an "Export data" link in the confirmation modal for users to download before deleting?
- Should the deleted event appear grayed-out or hidden in the `/tabs` list?