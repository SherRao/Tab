## 1. Viewer Summary Component

- [ ] 1.1 Create `src/components/event/viewer-summary.tsx` as a server component that accepts `viewerParticipantId`, `netCents`, `transferCount`, and `settleUpId` props. Renders the banner with `paper-card` styling: "You owe $X to N person(s)" / "You get back $X from N person(s)" / "You're all settled up". Includes an `<a href="#settle-up">` scroll link. Returns null when `viewerParticipantId` is null. Verify: component renders correctly in isolation by importing it in the page (task 3.1).

- [ ] 1.2 Add `id="settle-up"` to the SettleUpList section wrapper in the event page so the anchor link has a target. Verify: inspect the rendered HTML and confirm the settle-up section has the correct id attribute.

## 2. Two-Column Grid Layout

- [ ] 2.1 In `src/app/(app)/e/[token]/page.tsx`, change `<main>` from `max-w-2xl` to `max-w-6xl lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8`. Wrap components into two `<div>` groups: main column (EventHeader, ViewerSummary, ErrorNote, UnassignedWarnings, ReceiptList) and sidebar column (BalanceList, ClaimRequests, SettleUpList, GroupManager, Actions). Verify: on a 1024px+ viewport, the page renders as two columns with receipts on the left and balances/settle-up on the right.

- [ ] 2.2 Add `order-first lg:order-none` to the sidebar wrapper so balances appear before receipts on mobile. Verify: on a narrow viewport (<1024px), the section order matches the current single-column layout (header → balances → warnings → settle-up → receipts → groups → actions).

- [ ] 2.3 Add sticky sidebar classes: `lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto` to the sidebar wrapper. Verify: on a wide viewport with 5+ receipts, scroll down and confirm the sidebar stays pinned. With many participants (or simulated tall sidebar), confirm the sidebar scrolls independently.

## 3. Wire Viewer Data

- [ ] 3.1 In the event page, compute viewer summary data: find the viewer's participant (`people.find(p => p.userId === viewer?.id)`), look up their net from the `nets` map, count their transfers from the `transfers` array (where `fromId` or `toId` matches). Pass these to `ViewerSummary`. Verify: sign in as a linked participant and confirm the banner shows the correct net balance and transfer count. View as a non-participant and confirm the banner is hidden.

## 4. Visual Polish and Verification

- [ ] 4.1 Test the mobile layout at common breakpoints (375px, 768px) to ensure single-column stacking is correct with the viewer summary after the header. Verify: resize the browser or use device emulation and confirm no layout breakage, overlapping content, or missing sections.

- [ ] 4.2 Test the wide layout at 1024px and 1440px. Verify: both columns render with appropriate proportions, the sidebar is sticky, and all existing component interactions (add participant, edit expense, delete tab, claim, group management) still work.

- [ ] 4.3 Run `npm test` and `npm run lint` to confirm no regressions in ledger math or lint violations. Verify: all tests pass, no new lint errors.
