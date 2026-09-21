## Why

The event dashboard stacks 7 sections in a single column at `max-w-2xl`, requiring excessive scrolling once an event has a few receipts and participants. The most-wanted information — "who owes what" and "what do I owe" — scrolls out of view while browsing receipts. A two-column layout at desktop widths, combined with a personal summary for the signed-in viewer, would let users see balances and settlements at a glance while scrolling through receipts — similar to Splitwise's sidebar approach.

## What Changes

- Restructure the event dashboard page (`/e/[token]`) into a two-column grid at `lg:` breakpoint (1024px+). Mobile stays single-column.
- **Main column (~60%):** Event header, unassigned warnings, receipts.
- **Sidebar (~40%, sticky):** "You" summary strip, balances, settle-up, groups, actions.
- Add a "You" summary component at the top of the sidebar showing the signed-in viewer's personal net position (e.g., "You get back $47.00 from 2 people", "You owe $23.00 to 1 person"). Shows nothing for anonymous viewers; shows a nudge for signed-in users not yet in the tab.
- Claim requests move into the sidebar, nested under balances.

## Capabilities

### New Capabilities

- `viewer-summary`: Personal net-position summary shown to the signed-in viewer on the event dashboard — what they owe or are owed, and to/from how many people.

### Modified Capabilities

_None. The layout restructure is presentational; existing balance computation and settlement logic are unchanged._

## Impact

- `src/app/(app)/e/[token]/page.tsx` — grid layout wrapper, section reordering.
- `src/components/event/` — new `viewer-summary.tsx` component; minor prop/wrapper changes to existing dashboard components for sidebar placement.
- `src/app/globals.css` — possible sidebar sticky utility if not covered by Tailwind.
- No schema, API, or dependency changes.
