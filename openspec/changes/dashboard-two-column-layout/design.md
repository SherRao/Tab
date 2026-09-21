## Context

The event dashboard (`/e/[token]/page.tsx`) renders 7 sections in a single `max-w-2xl` column. All components are already extracted into `src/components/event/`. The page is a server component; only `BalanceBreakdown` and `GroupManager` use `"use client"`. The design system provides `paper-card`, `receipt-card`, and related utilities in `globals.css`, with Tailwind v4 `@theme inline` tokens.

## Goals / Non-Goals

**Goals:**
- Two-column grid at `lg:` with sticky sidebar; single-column below
- Viewer summary component using existing `computeNetBalances` + `simplifyDebts` data
- Zero changes to ledger computation, data fetching, or component APIs beyond what the layout requires

**Non-Goals:**
- Condensed balance chips (future improvement — keep the current list style for now)
- Receipt card 2-up grid at `xl:` (separate change)
- Any changes to mobile layout

## Decisions

### 1. CSS Grid on the page, not a layout component

Wrap the page's `<main>` content in a `lg:grid lg:grid-cols-[1fr_minmax(280px,340px)] lg:gap-8` container. The left column gets a `<div>` wrapper; the right column gets a `<aside>` with `lg:sticky lg:top-8 lg:self-start`.

**Why not a reusable layout component:** This layout is specific to the event dashboard. Extracting a `TwoColumnLayout` adds indirection for a single use site. If other pages need it later, extract then.

**Alternative considered:** Flexbox with `flex-row-reverse` to put sidebar first in DOM for mobile. Rejected because grid gives explicit column sizing and the current DOM order (header first) is fine for mobile.

### 2. Section reordering for the sidebar

Sidebar sections in order: viewer summary, balances (with claim requests inlined), settle-up, groups, actions. Main column: event header, unassigned warnings, receipts.

**Why settle-up in sidebar:** It's the action item derived from balances — keeping it next to balances tells the complete "who owes what and what to do" story in one sticky panel. It's also typically short (1-3 transfers).

**Why warnings stay in main column:** Warnings reference specific receipts with unassigned items. Placing them above receipts creates a natural "fix this → scroll down to the receipt" flow.

### 3. Viewer summary as a server component

Create `src/components/event/viewer-summary.tsx`. It receives the viewer's participant ID (if any), the `nets` map, and the `transfers` array. It derives the count of people involved from transfers. No client state needed — pure render.

**Data already available:** The page already computes `nets` (Map<id, cents>) and `transfers` (array of {fromId, toId, amountCents}), and resolves `viewer` and their participant ID via `viewerClaimedIds`. No new queries required.

### 4. Breakpoint choice: `lg:` (1024px)

At `md:` (768px) the sidebar would compress below ~240px usable width, making balance rows awkward. `lg:` gives the sidebar 280-340px, enough for balance text and amounts side by side.

## Risks / Trade-offs

- **Sidebar sticky + long balance lists:** If an event has 15+ participants, the sticky sidebar could exceed viewport height. Mitigation: `lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto` on the aside, adding scroll within the sidebar itself. This handles the edge case without affecting typical 3-6 person events.
- **Claim requests in sidebar:** Claim request cards are wider than typical sidebar content (they have approve/deny buttons). At 280px minimum sidebar width the buttons may wrap. Acceptable — they already use `flex-wrap` and render fine at narrow widths.
