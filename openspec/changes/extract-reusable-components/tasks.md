## 1. Shared lib helpers

- [x] 1.1 Create `src/lib/format.ts` with `formatCents` (USD display via `toLocaleString`, from event page), `toFixedMoney` (`toFixed(2)`), and `toCents` (moved verbatim from expense-editor); verify with a quick vitest run that nothing imports it yet (`npm test`)
- [x] 1.2 Create `src/lib/motion.ts` exporting `delayStyle`; verify file compiles via `npm run build`

## 2. UI primitives

- [x] 2.1 Create `src/components/ui/error-note.tsx` with `variant: "page" | "form"` carrying the exact existing class sets; verify no `"use client"` needed by using it in a server page
- [x] 2.2 Create `src/components/ui/section-heading.tsx`, `empty-state.tsx`, `field.tsx`, `watermark.tsx` as server-compatible components moving JSX verbatim; verify rendered output matches original markup
- [x] 2.3 Create client `src/components/ui/money-input.tsx` ($-prefix decimal input) and `chip-toggle-group.tsx` (size prop preserving both current chip styles); verify in isolation inside the editor before wiring all four/two call sites
- [x] 2.4 Move `copy-link-button.tsx` and `reveal.tsx` to `src/components/ui/` and `site-header.tsx` to `src/components/layout/`; update imports in event page, landing page, app layout; verify `rg -n '@/components/(copy-link-button|reveal|site-header)' src` returns only new paths and `npm run build` passes

## 3. People selection split

- [x] 3.1 Split `add-people.tsx` into `src/components/people/use-account-search.ts`, `search-chooser.tsx`, `create-event-people-input.tsx`, `add-someone-control.tsx` with identical exports/behavior; delete old file; verify `rg -n 'add-people' src` finds nothing and create-tab-form + event page imports updated
- [x] 3.2 Smoke-check add-person flow on an event page in dev server (account/guest/invite choices appear); verify dropdown renders identically

## 4. Expense editor split

- [x] 4.1 Create `src/components/expense/split-mode-selector.tsx` and `line-item-row.tsx` (consuming `ui/money-input`, `ui/chip-toggle-group`); wire into orchestrator `expense-editor.tsx`; keep `EditorItem`/`EditorParticipant` exports unchanged; verify editor renders identically for itemized/even/group modes
- [x] 4.2 Move `new-expense-flow.tsx` and `scan-receipt.tsx` to `src/components/expense/`; replace local `toCents`/`formatMoney`/`delayStyle`-style helpers with `lib/format` imports; verify scan → review → save flow works in dev server
- [x] 4.3 Update `EditorItem` import path in `src/lib/__tests__/receipt-editor-flow.test.ts` and type imports in new/edit pages; verify `npm test` passes

## 5. Event dashboard extraction

- [x] 5.1 Rename `delete-event-button.tsx` → `src/components/event/delete-tab-button.tsx` and update its single import site; verify owner sees working delete button
- [x] 5.2 Extract `event-header.tsx`, `balance-list.tsx`, `claim-requests.tsx`, `settle-up-list.tsx`, `receipt-list.tsx` + `receipt-card.tsx`, `unassigned-warnings.tsx` from `e/[token]/page.tsx` one section at a time, running `npm run build` between each; verify page is composition-only (no inline section definitions) and diff of rendered HTML is empty
- [x] 5.3 Replace inline error banners/watermark usages across pages with `ui/error-note` / `ui/watermark`; verify all error paths (bad token, claim errors) still render correctly

## 6. Auth forms

- [x] 6.1 Extract `src/components/auth/sign-in-form.tsx` (incl. sent-state card) and `sign-up-form.tsx` using `ui/field` + `ui/error-note`; verify signin/signup pages render identically including error messages
- [x] 6.2 Replace duplicated `delayStyle` helpers in home/create/signin with `lib/motion`; verify rise-in animations still fire

## 7. Marketing blocks

- [x] 7.1 Extract `landing-header`, `hero-section`, `cta-card`, `receipt-stack` (MiniReceipt + sway), `feature-list` (FeatureRow), `how-it-works`, `landing-footer` into `src/components/marketing/`; verify landing page HTML matches pre-refactor build output

## 8. Docs + full verification

- [x] 8.1 Update AGENTS.md architecture section paths (`expense-editor`, component layout); verify doc references match tree
- [x] 8.2 Run `npm test`, `npm run lint`, `npm run build` — all green with no test edits beyond import paths
- [x] 8.3 Dev-server visual pass over `/`, `/signin`, `/signup`, `/create`, `/tabs`, one seeded event page (balances, claims, settle-up, receipts); verify zero visual differences
