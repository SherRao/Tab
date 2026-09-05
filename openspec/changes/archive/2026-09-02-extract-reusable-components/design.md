## Context

Tab's UI is server-component-first with `"use client"` only where state exists. Design-system utilities (`receipt-card`, `label-mono`, `input-ink`, `btn-ink`, `leader-dots`, …) live in `src/app/globals.css`. Money is integer cents end-to-end (AGENTS.md). Today 9 component files exist; the event dashboard and expense editor inline their sections, and shared patterns are duplicated across pages (see proposal.md — Why). Existing specs under `openspec/specs/` describe runtime behavior only; none change here.

## Goals / Non-Goals

**Goals:**

- One home per recurring pattern; pages become composition files.
- Byte-identical rendered output after extraction (verified by build + smoke check).
- Import-path updates confined to known sites: `receipt-editor-flow.test.ts`, new/edit expense pages, `create-tab-form.tsx`, internal component imports.

**Non-Goals:**

- No visual redesign, no class consolidation/cleanup, no prop API redesign of existing components beyond what extraction requires.
- No unification of the landing page's decorative `MiniReceipt` with the dashboard `receipt-card` — different data shapes, hover behavior, and purpose.
- No changes to ledger math, actions, queries, schema, or routing.

## Decisions

1. **Subfolder taxonomy over flat root.** `ui/` for primitives reused across domains; domain folders (`event/`, `expense/`, `people/`, `auth/`, `marketing/`, `layout/`) for composed feature blocks. Alternative (flat root with name prefixes) rejected: the tree now spans ~25 files and prefixes don't scale as well for browsing.
2. **Prop-driven variance, not copies.** Where duplicated markup differs slightly (chip group padding/font-size, error banner page vs form variant), the primitive takes a `size`/`variant` prop carrying the exact existing class sets. Alternatives considered: leave duplicates in place (defeats purpose) or normalize classes (violates parity invariant).
3. **Server-by-default primitives.** Only components with hooks/state get `"use client"`: `money-input`, `chip-toggle-group`, `copy-link-button`, `reveal`, everything under `people/` and `expense/` that holds state. `error-note`, `field`, `section-heading`, `empty-state`, `watermark`, all `event/*` sections, all `marketing/*` blocks stay server components.
4. **Money helpers in `src/lib/format.ts`, not a component module.** `formatCents` (display, `toLocaleString` USD), `toFixedMoney` (editor strings, `toFixed(2)`), `toCents` (parse user input; moved from expense-editor). Rationale: needed by both server and client code; AGENTS.md already frames these as lib-level conventions. `delayStyle` goes to `src/lib/motion.ts` since it feeds CSS animation custom properties.
5. **Event-page data flow preserved.** Dashboard computes nets/transfers/name lookups once, passes results down to `event/*` server components as props (plain objects/entries where convenient). Server-action forms stay inside `event/*` components exactly as today.
6. **Editor split keeps types exported from the orchestrator.** `expense-editor.tsx` remains the public surface exporting `EditorItem`/`EditorParticipant`; `split-mode-selector` and `line-item-row` become internal client modules consuming `money-input` and `chip-toggle-group`.
7. **`create-tab-form.tsx` stays top-level.** Single cohesive two-step form; moving it into a folder adds indirection without reuse.
8. **Test compatibility over test edits.** Keep named exports (`canContinueToPeople`, `EditorItem`) identical; only import paths change.

## Risks / Trade-offs

- [Visual drift during manual extraction] → move JSX verbatim; classes byte-identical; variance only via props; dev-server smoke check on `/`, `/signin`, `/tabs`, an event page after each major step.
- [Hidden coupling in the 427-line dashboard] → extract one section per commit-sized unit; run `npm run build` between steps to catch type breakage early.
- [Broken imports in tests/pages] → grep-driven sweep of `@/components/` references at each move; final `npm test`.
- [Over-abstraction risk] → extract only measured duplication (counts in proposal); single-use marketing blocks are extracted for readability per user direction, not reuse claims.
- [Next.js version drift vs training data] → consult bundled docs in `node_modules/next/dist/docs/` if any Next API nuance surfaces during the work (none expected).

## Migration Plan

Work proceeds inside the repo with no deploy implications; order of operations is codified in tasks.md (libs → ui → people → expense → event → auth → marketing → AGENTS.md path updates → full verification). Rollback = revert commits; no data or schema involvement.

## Open Questions

None.
