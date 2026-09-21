## Context

The event page (`src/app/(app)/e/[token]/page.tsx`) is a server component that fetches all event data and composes ~7 section components inside a single `max-w-2xl` container. The page already resolves the viewer via `getSessionUser()` and knows which participants are linked to users via `participants.userId`. Net balances (`nets`) and simplified transfers (`transfers`) are computed per render — no new data fetching is needed.

The design system uses paper/ink tokens in `globals.css` with Tailwind v4's `@theme inline`. Existing utilities (`paper-card`, `receipt-card`, `label-mono`, etc.) should be reused. The page is a server component; the viewer summary can also be a server component since it only displays computed data.

## Goals / Non-Goals

**Goals:**
- Reduce vertical scrolling on wide viewports by moving reference panels (balances, settle-up) to a sticky sidebar
- Give signed-in participants an instant "what do I owe?" answer
- Preserve mobile layout and all existing component behavior

**Non-Goals:**
- Compact/chip-style balance redesign (future follow-up, can layer on top)
- Receipt 2-up grid on extra-wide screens (future follow-up)
- Any backend, schema, or ledger math changes

## Decisions

### Grid approach: CSS grid with Tailwind classes

Use a CSS grid on the `<main>` element with `lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8`. Below `lg`, the grid falls back to single-column block flow.

**Alternative considered:** Flexbox with percentage widths. Grid is cleaner here because the sidebar is sticky and independent of the main column's height.

The `max-w-2xl` constraint on `<main>` expands to `max-w-6xl` (or wider) to accommodate two columns. Mobile still reads narrower because columns collapse.

### Main column vs sidebar composition

The page component renders two wrapper `<div>`s inside the grid:
- Main: `<div>` containing EventHeader, ViewerSummary, UnassignedWarnings, ReceiptList
- Sidebar: `<div className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">` containing BalanceList, SettleUpList, ClaimRequests, GroupManager, DeleteTabButton

On mobile (below `lg`), both divs are block-level and stack naturally. The sidebar div appears after the main div in the DOM; on mobile this means balances/settle-up come after receipts. To preserve the current mobile order (balances before receipts), we can use `lg:order` classes: sidebar gets `order-first lg:order-none` so it appears first on mobile but flows naturally on desktop.

**Alternative considered:** Rendering sidebar components in both positions and hiding one with responsive display classes. Rejected — duplicates DOM nodes and component instances.

### Viewer summary: server component

`ViewerSummary` is a new server component at `src/components/event/viewer-summary.tsx`. It receives:
- `viewerParticipantId: number | null` — the matched participant ID (null if viewer isn't linked)
- `netCents: number` — the viewer's net balance from the `nets` map
- `transferCount: number` — count of transfers involving the viewer from the `transfers` array
- `settleUpId: string` — the DOM id of the settle-up section for scroll targeting

The page resolves `viewerParticipantId` by finding the participant where `p.userId === viewer?.id`. The net and transfer count are looked up from existing computed data.

The banner uses `paper-card` styling with accent-colored text for the amount. The scroll-to link uses a plain `<a href="#settle-up">` anchor, and the settle-up section gets `id="settle-up"`.

### Sticky sidebar overflow

The sidebar wrapper uses `lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto` so that when content exceeds the viewport (many participants), the sidebar scrolls independently. The `6rem` offset accounts for the site header and top padding.

## Risks / Trade-offs

- **[DOM order vs visual order]** On mobile, we want balances above receipts (current behavior). On desktop, the sidebar (right column) contains balances. Using `order-first lg:order-none` on the sidebar div means screen readers and tab order hit sidebar content first on all viewports. This matches the visual order on mobile and is acceptable on desktop where balances are visually prominent in the sidebar. → Acceptable trade-off; screen reader order matches importance hierarchy.
- **[Sticky sidebar height]** If a user has 20+ participants, the sidebar itself could overflow. The `overflow-y-auto` on the sidebar wrapper handles this, but it adds a nested scroll region which can feel awkward. → Mitigation: the sidebar only scrolls when it genuinely overflows; most events have 3-8 people.
- **[Viewer identity resolution]** The viewer's participant is found by `p.userId === viewer.id`. If a user has multiple participants linked (shouldn't happen per the unique index), only the first match is used. → The `participants_user_unique` index prevents duplicates within an event.
