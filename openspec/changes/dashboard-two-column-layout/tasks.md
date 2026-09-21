## 1. Viewer Summary Component

- [x] 1.1 Create `src/components/event/viewer-summary.tsx` as a server component. It receives: `viewer` (signed-in user or null), `viewerParticipantId` (number or null — the participant ID the viewer has claimed), `nets` (Map<number, number>), and `transfers` (array of {fromId, toId, amountCents}). Derive the viewer's net from `nets`, count involved people from `transfers`, and render the summary text per spec (gets back / owes / settled / not in tab / nothing for anonymous). Verify: component renders correct text for each viewer state by inspecting the dev server at `/e/[token]` while signed in and signed out.

## 2. Two-Column Grid Layout

- [x] 2.1 In `src/app/(app)/e/[token]/page.tsx`, wrap the page content below `<EventHeader>` in a grid container: `lg:grid lg:grid-cols-[1fr_minmax(280px,340px)] lg:gap-8`. Wrap main-column sections (unassigned warnings, receipts) in a `<div>`. Wrap sidebar sections (viewer summary, balances, claim requests, settle-up, groups, actions) in an `<aside className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">`. Keep `<EventHeader>` above the grid, spanning full width. Verify: at `lg:` and above the page renders two columns; below `lg:` it renders single-column. Sidebar sticks while scrolling receipts.

- [x] 2.2 Widen the page's `max-w` from `max-w-2xl` to `max-w-6xl` (or remove it) so the two-column grid has room to breathe at desktop widths. Verify: at 1280px viewport width both columns are comfortably sized, receipts don't feel stretched.

## 3. Section Reordering

- [x] 3.1 Move `<ClaimRequests>` from its current position (between BalanceList and UnassignedWarnings) into the sidebar, directly after `<BalanceList>`. Move `<SettleUpList>` into the sidebar after claim requests. Move `<GroupManager>` section and `<DeleteTabButton>` section into the sidebar after settle-up. Verify: sidebar order is viewer-summary → balances → claim requests → settle-up → groups → actions. Main column order is header → warnings → receipts.

## 4. Verification

- [x] 4.1 Run `npm run build` and confirm no type or build errors. Run `npm test` and confirm all existing tests pass. Visually verify the dashboard at mobile (375px), tablet (768px), and desktop (1280px) viewports in the dev server — mobile/tablet should look like the current single-column layout, desktop should show the two-column layout with sticky sidebar.
