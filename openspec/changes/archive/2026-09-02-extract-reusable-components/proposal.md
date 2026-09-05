## Why

The event dashboard (`e/[token]/page.tsx`, 427 lines) and expense editor (`expense-editor.tsx`, 432 lines) carry nearly all UI inline, and shared patterns are copy-pasted across files: `$`-prefixed money input ×4, participant chip group ×2, label+input field combo ×7, section heading ×5, error banner in 2 variants across 4 files, `formatCents`/`formatMoney` defined twice, `delayStyle` duplicated in 3 pages. Every new screen re-implements these instead of composing them.

## What Changes

- Introduce shared primitives under `src/components/ui/`: `error-note`, `field`, `section-heading`, `empty-state`, `watermark`, `money-input`, `chip-toggle-group`, plus relocated `copy-link-button` and `reveal`.
- Split monoliths into domain folders:
  - `components/event/` — `event-header`, `balance-list`, `claim-requests`, `settle-up-list`, `receipt-list`, `receipt-card`, `unassigned-warnings`, `delete-tab-button` (renamed from `delete-event-button`)
  - `components/expense/` — `expense-editor` (orchestrator), `split-mode-selector`, `line-item-row`, `new-expense-flow`, `scan-receipt`
  - `components/people/` — `use-account-search`, `search-chooser`, `create-event-people-input`, `add-someone-control` (split out of `add-people.tsx`)
  - `components/auth/` — `sign-in-form`, `sign-up-form`
  - `components/marketing/` — landing page blocks: `landing-header`, `hero-section`, `cta-card`, `receipt-stack` (MiniReceipt + sway wrappers), `feature-list`, `how-it-works`, `landing-footer`
  - `components/layout/site-header.tsx` (relocated)
- Add shared helpers: `src/lib/format.ts` (`formatCents`, `toFixedMoney`, `toCents`) and `src/lib/motion.ts` (`delayStyle`).
- Pure refactor invariant: rendered markup and classNames stay identical; no behavior, routing, or data changes.
- Update affected import sites: `src/lib/__tests__/receipt-editor-flow.test.ts` (`EditorItem`), new/edit expense pages, `create-tab-form.tsx`.

## Capabilities

### New Capabilities

- `frontend-component-system`: rules for how Tab's UI is composed — where primitives live, when a pattern must be extracted, money formatting discipline, and the requirement that refactors do not alter rendered output. Existing runtime capabilities (expense splitting, receipt scanning, tab creation, etc.) are unaffected.

### Modified Capabilities

- None. No existing capability's spec-level behavior changes; all deltas here are structural.

## Impact

- **Code**: all pages under `src/app/`, all 9 existing files in `src/components/`, two new files in `src/lib/`; one test file import path.
- **APIs**: none. Server actions keep flowing through unchanged; props between server components stay server-side (no serialization concerns).
- **Dependencies**: none added or removed.
- **Verification**: `npm test`, `npm run lint`, `npm run build` must pass with no visual or behavioral change.
