## Why

Permanent deletion of events (tabs) by their creator. Currently there is no way for the event owner to remove a tab, which means orphaned or unwanted events accumulate. Users need a way to clean up events they no longer want, with proper confirmation and share link invalidation.

## What Changes

- Add `deleteEventAction` server action that permanently deletes an event and cascades to all dependent data (participants, expenses, line items, shares)
- Add delete confirmation UI in EventPage visible only to the event owner
- Invalidate share links immediately upon deletion (share token becomes invalid)
- Export data option available before permanent deletion

## Capabilities

### New Capabilities

- `event-deletion`: Permanent event deletion by the creator, with share link invalidation and data export before purge

### Modified Capabilities

(none)

## Impact

- **`src/lib/actions.ts`**: New `deleteEventAction` function - owner-gated event deletion
- **`src/app/e/[token]/page.tsx`**: Delete button for owners with confirmation dialog
- **Share links**: Immediately invalidated after deletion; `/e/<token>` shows "event deleted" state
- **Data model**: Relies on SQLite `onDelete: "cascade"` foreign keys for automatic cleanup

### No Longer Needed (deferred)

- Group-aware deletion (future change)
- Soft-delete restoration UI (future change)