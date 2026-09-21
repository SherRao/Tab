## Why

The event dashboard stacks 7 sections in a single narrow column. With a few receipts and 4-5 participants, users scroll excessively to find balances, settle-up info, and receipts. Signed-in users also see the same participant-neutral view as anonymous viewers — there's no "what do I owe?" at a glance.

## What Changes

- **"You" summary banner**: When the viewer is signed in and linked to a participant, a personal summary strip appears below the header showing their net position ("You get back $47.00 from 2 people" / "You owe $23.00 to 1 person") with a tap target to scroll to settle-up. Graceful fallbacks: not signed in shows "Sign in to see your balance"; signed in but not a participant hides the banner.
- **Two-column layout at `lg:` breakpoint**: The dashboard switches to a ~60/40 split at 1024px+. Left/main column holds the header, "You" summary, unassigned warnings, and receipts (the scrollable content). Right sidebar (sticky) holds balances, settle-up, claim requests, groups, and owner actions.
- **Mobile stays single-column**: Current stacking order preserved, with "You" summary injected after the header.
- **Information hierarchy shift**: Receipts become the primary content column. Balances and settle-up are always visible in the sidebar. Groups and owner actions are de-emphasized at the sidebar bottom.

## Capabilities

### New Capabilities
- `dashboard-layout`: Two-column responsive layout for the event dashboard and personalized viewer summary banner.

### Modified Capabilities
- `balances`: Adds a requirement for a viewer-specific summary derived from existing net-balance data when the viewer is a linked participant.

## Impact

- `src/app/(app)/e/[token]/page.tsx` — restructured to a CSS grid layout with sidebar composition; computes viewer's participant match and personal balance data.
- New `src/components/event/viewer-summary.tsx` — "You" summary banner component.
- `src/components/event/balance-list.tsx` — may gain a compact variant or styling adjustments for sidebar context.
- `src/app/globals.css` — new grid utilities for the 2-column layout.
- No backend, schema, or ledger math changes. All data already available on the page.
